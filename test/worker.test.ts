import { spawn } from "child_process";
import path from "path";

describe('Worker Daemon', () => {
    test('should start and shutdown gracefully on SIGTERM after 10 seconds', async () => {
        // Increase Jest timeout for this long-running test.
        jest.setTimeout(5000);

        // Resolve the worker.ts path (assumes ts-node is installed)
        const workerPath = path.join(__dirname, "../src/worker.ts");
        const workerProcess = spawn("ts-node", [workerPath]);

        let stdoutData = "";
        workerProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        // Wait for 3 seconds before sending SIGTERM
        await new Promise<void>(resolve => setTimeout(resolve, 3000));

        // Send SIGTERM to the process.
        workerProcess.kill("SIGTERM");

        const exitCode: number = await new Promise(resolve => {
            workerProcess.on('exit', (code) => resolve(code ?? 0));
        });

        expect(stdoutData).toMatch(/Received SIGTERM, shutting down/);
        expect(exitCode).toBe(0);
    });
}); 