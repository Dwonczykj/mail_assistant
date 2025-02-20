import { exec } from 'child_process';

/**
 * Opens the given URL in the default browser using a cross-platform command.
 * @param url - The URL to open.
 * @returns {Promise<void>} A promise that resolves when the browser is successfully launched.
 */
export async function openUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        let command: string;

        // Determine the correct command for the current platform.
        if (process.platform === 'win32') {
            command = 'start';
        } else if (process.platform === 'darwin') {
            command = 'open';
        } else {
            // For Linux and others.
            command = 'xdg-open';
        }

        // Execute the command to open the URL.
        exec(`${command} "${url}"`, (error) => {
            if (error) {
                console.error('Error opening URL:', error);
                return reject(error);
            }
            resolve();
        });
    });
} 