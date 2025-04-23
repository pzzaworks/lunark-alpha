import { exec } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { config } from 'dotenv';
import { parse } from 'pg-connection-string';

// Load environment variables from the root directory
config({ path: join(__dirname, '../.env') });

async function backupDatabase() {
    try {
        // Parse DATABASE_URL
        const dbConfig = parse(process.env.DATABASE_URL || '');
        if (!dbConfig.host || !dbConfig.port || !dbConfig.user || !dbConfig.database) {
            throw new Error('Invalid database configuration');
        }
        
        // Create backups directory if it doesn't exist
        const backupDir = join(__dirname, '../backups');
        await mkdir(backupDir, { recursive: true });

        // Generate backup filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = join(backupDir, `backup_${timestamp}.sql`);

        // Construct pg_dump command
        const pgDumpCmd = [
            'pg_dump',
            `-h ${dbConfig.host}`,
            `-p ${dbConfig.port}`,
            `-U ${dbConfig.user}`,
            `-d ${dbConfig.database}`,
            '--no-owner',
            '--no-acl'
        ].join(' ');

        // Execute pg_dump
        console.log('Creating database backup...');
        const child = exec(pgDumpCmd, {
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
            child.on('close', async (code) => {
                if (code === 0) {
                    await writeFile(backupFile, output);
                    console.log(`Backup successfully created at: ${backupFile}`);
                    resolve(null);
                } else {
                    console.error('pg_dump error output:', errorOutput);
                    reject(new Error(`pg_dump failed with code ${code}: ${errorOutput}`));
                }
            });
            child.on('error', (error) => {
                console.error('Execution error:', error);
                reject(error);
            });
        });

    } catch (error) {
        console.error('Backup failed:', error);
        process.exit(1);
    }
}

backupDatabase();