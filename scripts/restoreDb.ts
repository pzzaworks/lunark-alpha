import { exec } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { config } from 'dotenv';
import { parse } from 'pg-connection-string';

// Load environment variables from the root directory
config({ path: join(__dirname, '../.env') });

async function restoreDatabase() {
    try {
        // Check if backup file is provided
        const backupFile = process.argv[2];
        if (!backupFile) {
            console.error('Please provide the backup file path');
            console.error('Usage: yarn db:restore <backup_file>');
            process.exit(1);
        }

        // Parse DATABASE_URL
        const dbConfig = parse(process.env.DATABASE_URL || '');
        if (!dbConfig.host || !dbConfig.port || !dbConfig.user || !dbConfig.database) {
            throw new Error('Invalid database configuration');
        }

        // Verify backup file exists
        try {
            await readFile(backupFile);
        } catch (error) {
            console.error(`Backup file not found: ${backupFile}`);
            process.exit(1);
        }

        // Construct psql command
        const psqlCmd = [
            'psql',
            `-h ${dbConfig.host}`,
            `-p ${dbConfig.port}`,
            `-U ${dbConfig.user}`,
            `-d ${dbConfig.database}`,
            '-f',
            backupFile
        ].join(' ');

        // Execute psql restore
        console.log(`Restoring database from backup: ${backupFile}`);
        const child = exec(psqlCmd, {
            env: {
                ...process.env,
                PGPASSWORD: dbConfig.password
            }
        });

        // Collect output and errors
        let output = '';
        let errorOutput = '';
        
        child.stdout?.on('data', (data) => {
            output += data;
        });

        child.stderr?.on('data', (data) => {
            errorOutput += data;
        });

        // Handle completion
        await new Promise((resolve, reject) => {
            child.on('close', (code) => {
                if (code === 0) {
                    console.log('Database restored successfully!');
                    console.log('Output:', output);
                    resolve(null);
                } else {
                    console.error('psql error output:', errorOutput);
                    reject(new Error(`psql failed with code ${code}: ${errorOutput}`));
                }
            });
            child.on('error', (error) => {
                console.error('Execution error:', error);
                reject(error);
            });
        });

    } catch (error) {
        console.error('Restore failed:', error);
        process.exit(1);
    }
}

restoreDatabase();