import * as fs from 'fs';
import * as path from 'path';

export class CoordinationWrapper {
    private editLogPath: string;
    private ledgerLogPath: string;
    private readonly MAX_LINES = 50;
    private isRotating = false;

    constructor(workspaceDir: string) {
        this.editLogPath = path.resolve(workspaceDir, 'edit.log');
        this.ledgerLogPath = path.resolve(workspaceDir, 'ledger.log');
        this.init();
    }

    private init() {
        if (!fs.existsSync(this.editLogPath)) fs.writeFileSync(this.editLogPath, '', 'utf8');
        if (!fs.existsSync(this.ledgerLogPath)) fs.writeFileSync(this.ledgerLogPath, '', 'utf8');

        fs.watchFile(this.editLogPath, { interval: 500 }, () => {
            this.rotate();
        });
    }

    public rotate() {
        if (this.isRotating) return;
        this.isRotating = true;

        try {
            // Using a read stream or readFileSync for small files
            const content = fs.readFileSync(this.editLogPath, 'utf8');
            const lines = content.split(/\r?\n/).filter(l => l.length > 0);

            if (lines.length > this.MAX_LINES) {
                const boundary = lines.length - this.MAX_LINES;
                const archived = lines.slice(0, boundary);
                const preserved = lines.slice(boundary);

                // Append to long-term ledger
                fs.appendFileSync(this.ledgerLogPath, archived.join('\n') + '\n', 'utf8');

                // Truncate and write preserved lines to edit log
                fs.writeFileSync(this.editLogPath, preserved.join('\n') + '\n', 'utf8');
            }
        } catch (e) {
            // No output per requirements
        } finally {
            this.isRotating = false;
        }
    }
}
