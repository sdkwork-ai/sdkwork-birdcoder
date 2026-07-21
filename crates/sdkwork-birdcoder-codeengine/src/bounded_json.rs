use std::{
    fmt,
    io::{self, BufReader, Read},
    marker::PhantomData,
    ops::ControlFlow,
};

use serde::{
    de::{self, DeserializeOwned, IgnoredAny, SeqAccess, Visitor},
    Deserialize, Deserializer,
};

const JSON_READ_CHUNK_BYTES: usize = 64 * 1024;

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub(crate) struct BoundedJsonlReadStats {
    pub(crate) skipped_oversized_records: usize,
}

pub(crate) fn for_each_bounded_jsonl_record<R, F>(
    reader: R,
    max_record_bytes: usize,
    mut callback: F,
) -> io::Result<BoundedJsonlReadStats>
where
    R: Read,
    F: FnMut(usize, &[u8]),
{
    for_each_bounded_jsonl_record_until(reader, max_record_bytes, |line_index, record| {
        callback(line_index, record);
        ControlFlow::Continue(())
    })
}

pub(crate) fn for_each_bounded_jsonl_record_until<R, F>(
    mut reader: R,
    max_record_bytes: usize,
    mut callback: F,
) -> io::Result<BoundedJsonlReadStats>
where
    R: Read,
    F: FnMut(usize, &[u8]) -> ControlFlow<()>,
{
    let mut chunk = [0_u8; JSON_READ_CHUNK_BYTES];
    let mut record = Vec::<u8>::with_capacity(max_record_bytes.min(JSON_READ_CHUNK_BYTES));
    let mut line_index = 0_usize;
    let mut discarding = false;
    let mut stats = BoundedJsonlReadStats::default();

    loop {
        let bytes_read = reader.read(&mut chunk)?;
        if bytes_read == 0 {
            break;
        }

        let mut segment_start = 0_usize;
        while let Some(relative_newline_index) = chunk[segment_start..bytes_read]
            .iter()
            .position(|byte| *byte == b'\n')
        {
            let newline_index = segment_start + relative_newline_index;
            append_bounded_record_segment(
                &mut record,
                &chunk[segment_start..newline_index],
                max_record_bytes,
                &mut discarding,
            );

            if discarding {
                stats.skipped_oversized_records = stats.skipped_oversized_records.saturating_add(1);
            } else {
                let flow = callback(
                    line_index,
                    strip_trailing_carriage_return(record.as_slice()),
                );
                if flow.is_break() {
                    return Ok(stats);
                }
            }

            record.clear();
            discarding = false;
            line_index = line_index.saturating_add(1);
            segment_start = newline_index + 1;
        }

        append_bounded_record_segment(
            &mut record,
            &chunk[segment_start..bytes_read],
            max_record_bytes,
            &mut discarding,
        );
    }

    if discarding {
        stats.skipped_oversized_records = stats.skipped_oversized_records.saturating_add(1);
    } else if !record.is_empty() {
        let _ = callback(
            line_index,
            strip_trailing_carriage_return(record.as_slice()),
        );
    }

    Ok(stats)
}

fn append_bounded_record_segment(
    record: &mut Vec<u8>,
    segment: &[u8],
    max_record_bytes: usize,
    discarding: &mut bool,
) {
    if *discarding || segment.is_empty() {
        return;
    }

    let remaining_bytes = max_record_bytes.saturating_sub(record.len());
    if segment.len() > remaining_bytes {
        record.clear();
        *discarding = true;
        return;
    }
    record.extend_from_slice(segment);
}

fn strip_trailing_carriage_return(record: &[u8]) -> &[u8] {
    record.strip_suffix(b"\r").unwrap_or(record)
}

pub(crate) fn from_bounded_json_reader<R, T>(reader: R, max_bytes: usize) -> serde_json::Result<T>
where
    R: Read,
    T: DeserializeOwned,
{
    let reader = ByteLimitedReader::new(reader, max_bytes);
    let reader = BufReader::with_capacity(JSON_READ_CHUNK_BYTES, reader);
    serde_json::from_reader(reader)
}

struct ByteLimitedReader<R> {
    inner: R,
    max_bytes: usize,
    remaining_bytes: usize,
}

impl<R> ByteLimitedReader<R> {
    fn new(inner: R, max_bytes: usize) -> Self {
        Self {
            inner,
            max_bytes,
            remaining_bytes: max_bytes,
        }
    }

    fn limit_error(&self) -> io::Error {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "JSON input exceeds the configured {} byte limit",
                self.max_bytes
            ),
        )
    }
}

impl<R> Read for ByteLimitedReader<R>
where
    R: Read,
{
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if buffer.is_empty() {
            return Ok(0);
        }
        if self.remaining_bytes == 0 {
            let mut overflow_probe = [0_u8; 1];
            return match self.inner.read(&mut overflow_probe)? {
                0 => Ok(0),
                _ => Err(self.limit_error()),
            };
        }

        let allowed_bytes = buffer.len().min(self.remaining_bytes);
        let bytes_read = self.inner.read(&mut buffer[..allowed_bytes])?;
        self.remaining_bytes = self.remaining_bytes.saturating_sub(bytes_read);
        Ok(bytes_read)
    }
}

pub(crate) fn deserialize_bounded_vec<'de, D, T>(
    deserializer: D,
    max_items: usize,
) -> Result<Vec<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    deserializer.deserialize_seq(BoundedVecVisitor::new(max_items))
}

pub(crate) fn deserialize_optional_bounded_vec<'de, D, T>(
    deserializer: D,
    max_items: usize,
) -> Result<Option<Vec<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    deserializer.deserialize_option(OptionalBoundedVecVisitor::new(max_items))
}

struct BoundedVecVisitor<T> {
    max_items: usize,
    marker: PhantomData<fn() -> T>,
}

impl<T> BoundedVecVisitor<T> {
    fn new(max_items: usize) -> Self {
        Self {
            max_items,
            marker: PhantomData,
        }
    }
}

impl<'de, T> Visitor<'de> for BoundedVecVisitor<T>
where
    T: Deserialize<'de>,
{
    type Value = Vec<T>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "a JSON array containing at most {} items",
            self.max_items
        )
    }

    fn visit_seq<A>(self, mut sequence: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let capacity = sequence.size_hint().unwrap_or_default().min(self.max_items);
        let mut values = Vec::<T>::with_capacity(capacity);
        for _ in 0..self.max_items {
            match sequence.next_element()? {
                Some(value) => values.push(value),
                None => return Ok(values),
            }
        }

        if sequence.next_element::<IgnoredAny>()?.is_some() {
            return Err(de::Error::custom(format!(
                "JSON array exceeds the configured {} item limit",
                self.max_items
            )));
        }
        Ok(values)
    }
}

struct OptionalBoundedVecVisitor<T> {
    max_items: usize,
    marker: PhantomData<fn() -> T>,
}

impl<T> OptionalBoundedVecVisitor<T> {
    fn new(max_items: usize) -> Self {
        Self {
            max_items,
            marker: PhantomData,
        }
    }
}

impl<'de, T> Visitor<'de> for OptionalBoundedVecVisitor<T>
where
    T: Deserialize<'de>,
{
    type Value = Option<Vec<T>>;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "null or a JSON array containing at most {} items",
            self.max_items
        )
    }

    fn visit_none<E>(self) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(None)
    }

    fn visit_unit<E>(self) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(None)
    }

    fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserialize_bounded_vec(deserializer, self.max_items).map(Some)
    }
}

#[cfg(test)]
mod tests {
    use std::{
        io::{self, Cursor, Read},
        ops::ControlFlow,
    };

    use serde_json::Value;

    use super::{
        for_each_bounded_jsonl_record, for_each_bounded_jsonl_record_until,
        from_bounded_json_reader, JSON_READ_CHUNK_BYTES,
    };

    #[test]
    fn bounded_jsonl_reader_discards_an_oversized_record_and_resumes_at_the_next_line() {
        let mut input = vec![b'x'; JSON_READ_CHUNK_BYTES + 17];
        input.extend_from_slice(b"\n{\"valid\":true}\n");
        let mut records = Vec::<(usize, Vec<u8>)>::new();

        let stats = for_each_bounded_jsonl_record(Cursor::new(input), 32, |line_index, record| {
            records.push((line_index, record.to_vec()));
        })
        .expect("scan bounded JSONL input");

        assert_eq!(stats.skipped_oversized_records, 1);
        assert_eq!(records, vec![(1, br#"{"valid":true}"#.to_vec())]);
    }

    #[test]
    fn bounded_jsonl_reader_accepts_the_exact_record_limit_and_discards_one_byte_more() {
        let mut records = Vec::<(usize, Vec<u8>)>::new();
        let stats = for_each_bounded_jsonl_record(
            Cursor::new(b"1234\n12345\nlast"),
            4,
            |line_index, record| records.push((line_index, record.to_vec())),
        )
        .expect("scan JSONL record boundaries");

        assert_eq!(stats.skipped_oversized_records, 1);
        assert_eq!(records, vec![(0, b"1234".to_vec()), (2, b"last".to_vec())]);
    }

    #[test]
    fn bounded_jsonl_reader_stops_reading_when_the_callback_breaks() {
        let mut input = b"first\nsecond\n".to_vec();
        input.resize(JSON_READ_CHUNK_BYTES * 2, b'x');
        let mut reader = CountingReader::new(input);
        let mut records = Vec::<(usize, Vec<u8>)>::new();

        let stats = for_each_bounded_jsonl_record_until(&mut reader, 16, |line_index, record| {
            records.push((line_index, record.to_vec()));
            ControlFlow::Break(())
        })
        .expect("stop bounded JSONL scan after first callback");

        assert_eq!(stats.skipped_oversized_records, 0);
        assert_eq!(records, vec![(0, b"first".to_vec())]);
        assert_eq!(reader.read_calls, 1);
        assert_eq!(reader.bytes_read, JSON_READ_CHUNK_BYTES);
    }

    #[test]
    fn bounded_json_reader_accepts_an_exact_byte_boundary() {
        let input = br#"{"value":"ok"}"#;
        let value = from_bounded_json_reader::<_, Value>(Cursor::new(input), input.len())
            .expect("parse JSON at exact byte limit");

        assert_eq!(value["value"], "ok");
    }

    #[test]
    fn bounded_json_reader_rejects_input_beyond_the_byte_limit() {
        let input = br#"{"value":"ok"}"#;
        let error = from_bounded_json_reader::<_, Value>(Cursor::new(input), input.len() - 1)
            .expect_err("reject JSON beyond byte limit");

        assert!(error
            .to_string()
            .contains("exceeds the configured 13 byte limit"));
    }

    struct CountingReader {
        bytes_read: usize,
        inner: Cursor<Vec<u8>>,
        read_calls: usize,
    }

    impl CountingReader {
        fn new(input: Vec<u8>) -> Self {
            Self {
                bytes_read: 0,
                inner: Cursor::new(input),
                read_calls: 0,
            }
        }
    }

    impl Read for CountingReader {
        fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
            self.read_calls = self.read_calls.saturating_add(1);
            let bytes_read = self.inner.read(buffer)?;
            self.bytes_read = self.bytes_read.saturating_add(bytes_read);
            Ok(bytes_read)
        }
    }
}
