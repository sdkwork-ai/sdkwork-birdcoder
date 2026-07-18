use std::io::{self, Write};

use sdkwork_birdcoder_kernel_bridge::{
    read_bounded_turn_request, serialize_bounded_turn_result, BirdcoderKernelHost,
    KernelTurnIoError,
};

fn main() {
    if let Err(error) = run() {
        let _ = writeln!(io::stderr().lock(), "{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), KernelTurnIoError> {
    let request = {
        let stdin = io::stdin();
        read_bounded_turn_request(stdin.lock())?
    };
    let host =
        BirdcoderKernelHost::bootstrap().map_err(|_| KernelTurnIoError::HostBootstrapFailed)?;
    let result = host.execute_turn(&request).map_err(|error| {
        #[cfg(debug_assertions)]
        eprintln!("kernel turn provider error: {error}");
        KernelTurnIoError::TurnExecutionFailed
    })?;
    let output = serialize_bounded_turn_result(&result)?;
    io::stdout()
        .lock()
        .write_all(&output)
        .map_err(|_| KernelTurnIoError::OutputWriteFailed)?;
    Ok(())
}
