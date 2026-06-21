use std::io::{self, Read, Write};

use sdkwork_birdcoder_codeengine::CodeEngineTurnRequestRecord;
use sdkwork_birdcoder_kernel_bridge::BirdcoderKernelHost;

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .map_err(|error| error.to_string())?;
    let request: CodeEngineTurnRequestRecord =
        serde_json::from_str(input.trim()).map_err(|error| error.to_string())?;
    let host = BirdcoderKernelHost::bootstrap().map_err(|error| error.to_string())?;
    let result = host.execute_turn(&request)?;
    let output = serde_json::to_string(&result).map_err(|error| error.to_string())?;
    io::stdout()
        .write_all(output.as_bytes())
        .map_err(|error| error.to_string())?;
    Ok(())
}
