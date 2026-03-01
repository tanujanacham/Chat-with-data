const calculateHealth = require("./services/datahealth");
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const duckdb = require('duckdb');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
console.log('Groq client initialized with key ending in:', process.env.GROQ_API_KEY?.slice(-4));

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
app.use('/public', express.static(path.join(__dirname, 'public')));

// Serve frontend static files
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

app.post("/health", (req, res) => {
    try {
        const { data } = req.body;
        console.log('Calculating health for data with', data?.length, 'rows');
        const result = calculateHealth(data);
        res.json(result);
    } catch (err) {
        console.error('Health Check Error:', err);
        res.status(500).json({ error: err.message });
    }
});
// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed!'), false);
        }
    }
});

// In-memory store for sessions (for demo purposes)
const sessions = new Map();

// Routes
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    const filePath = req.file.path;
    const sessionId = Date.now().toString();

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            // Extract schema (column names)
            const schema = results.length > 0 ? Object.keys(results[0]) : [];

            // Store session data
            sessions.set(sessionId, {
                filePath: filePath,
                schema: schema,
                data: results
            });

            res.json({
                message: 'File uploaded successfully',
                sessionId: sessionId,
                schema: schema,
                data: results, // Sending full data for the frontend grid
                fileUrl: `/public/uploads/${req.file.filename}`
            });
        })
        .on('error', (error) => {
            res.status(500).json({ error: 'Error parsing CSV file' });
        });
});

// ============================================================
// TRANSFORM EXECUTOR - Predefined safe SQL operations
// ============================================================
async function executeTransform(operation, params, filePath) {
    const db = new duckdb.Database(':memory:');
    const con = db.connect();

    // Helper to run a SQL statement as a promise
    const run = (sql) => new Promise((resolve, reject) => {
        con.run(sql, (err) => err ? reject(err) : resolve());
    });
    const all = (sql) => new Promise((resolve, reject) => {
        con.all(sql, (err, rows) => err ? reject(err) : resolve(rows));
    });

    // Load CSV into DuckDB with more robust options
    const normalizedPath = filePath.replace(/\\/g, '/');
    try {
        await run(`CREATE TABLE dataset AS SELECT * FROM read_csv_auto('${normalizedPath}', ignore_errors=true);`);
    } catch (setupErr) {
        console.error('Transform: DuckDB Setup Error:', setupErr);
        // Fallback for tricky paths: try relative path from CWD
        try {
            const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
            await run(`CREATE TABLE dataset AS SELECT * FROM read_csv_auto('${relPath}', ignore_errors=true);`);
        } catch (fallbackErr) {
            console.error('Transform: DuckDB Fallback Error:', fallbackErr);
            throw new Error(`Data access failed for transformation. Details: ${setupErr.message}`);
        }
    }

    const countBefore = (await all('SELECT COUNT(*) AS cnt FROM dataset'))[0].cnt;
    let message = '';

    switch (operation) {
        case 'remove_duplicates': {
            // Create a clean table with distinct rows, then replace original
            await run('CREATE TABLE dataset_clean AS SELECT DISTINCT * FROM dataset');
            await run('DROP TABLE dataset');
            await run('ALTER TABLE dataset_clean RENAME TO dataset');
            const countAfter = (await all('SELECT COUNT(*) AS cnt FROM dataset'))[0].cnt;
            const removed = Number(countBefore) - Number(countAfter);
            message = removed > 0
                ? `Done! Removed ${removed} duplicate row(s). Your dataset now has ${countAfter} rows.`
                : 'No duplicate rows were found. Your dataset is already clean!';
            break;
        }

        case 'fill_nulls': {
            const col = params.column;
            const method = params.method || 'zero';

            if (method === 'mean') {
                const avgResult = await all(`SELECT AVG(CAST("${col}" AS DOUBLE)) AS avg_val FROM dataset WHERE "${col}" IS NOT NULL`);
                const avg = avgResult[0].avg_val;
                await run(`UPDATE dataset SET "${col}" = ${avg} WHERE "${col}" IS NULL`);
                message = `Done! Filled null values in "${col}" with the mean value (${Number(avg).toFixed(2)}).`;
            } else if (method === 'median') {
                const medResult = await all(`SELECT MEDIAN(CAST("${col}" AS DOUBLE)) AS med_val FROM dataset WHERE "${col}" IS NOT NULL`);
                const med = medResult[0].med_val;
                await run(`UPDATE dataset SET "${col}" = ${med} WHERE "${col}" IS NULL`);
                message = `Done! Filled null values in "${col}" with the median value (${Number(med).toFixed(2)}).`;
            } else if (method === 'zero') {
                await run(`UPDATE dataset SET "${col}" = 0 WHERE "${col}" IS NULL`);
                message = `Done! Filled null values in "${col}" with 0.`;
            } else if (method === 'custom') {
                const val = params.value;
                const isNumeric = !isNaN(val);
                await run(`UPDATE dataset SET "${col}" = ${isNumeric ? val : `'${val}'`} WHERE "${col}" IS NULL`);
                message = `Done! Filled null values in "${col}" with "${val}".`;
            }
            break;
        }

        case 'remove_null_rows': {
            const col = params.column;
            if (col && col !== 'all') {
                await run(`DELETE FROM dataset WHERE "${col}" IS NULL`);
            } else {
                // Remove rows where ANY column is null
                const cols = await all("SELECT column_name FROM information_schema.columns WHERE table_name = 'dataset'");
                if (cols.length > 0) {
                    const nullChecks = cols.map(c => `"${c.column_name}" IS NULL`).join(' OR ');
                    await run(`DELETE FROM dataset WHERE ${nullChecks}`);
                }
            }
            const countAfter = (await all('SELECT COUNT(*) AS cnt FROM dataset'))[0].cnt;
            const removed = Number(countBefore) - Number(countAfter);
            message = removed > 0
                ? `Done! Removed ${removed} row(s) with null values. Your dataset now has ${countAfter} rows.`
                : 'No rows with null values were found.';
            break;
        }

        case 'rename_column': {
            const oldName = params.old_name;
            const newName = params.new_name;
            await run(`ALTER TABLE dataset RENAME COLUMN "${oldName}" TO "${newName}"`);
            message = `Done! Renamed column "${oldName}" to "${newName}".`;
            break;
        }

        case 'drop_column': {
            const col = params.column;
            await run(`ALTER TABLE dataset DROP COLUMN "${col}"`);
            message = `Done! Removed column "${col}".`;
            break;
        }

        case 'change_type': {
            const col = params.column;
            const type = params.target_type;
            // Using a casted copy to be safe with type conversions
            await run(`ALTER TABLE dataset ALTER COLUMN "${col}" TYPE ${type}`);
            message = `Done! Changed data type of "${col}" to ${type}.`;
            break;
        }

        case 'string_cleanup': {
            const col = params.column;
            const action = params.action;
            if (action === 'trim') {
                await run(`UPDATE dataset SET "${col}" = TRIM("${col}")`);
                message = `Done! Trimmed whitespace from "${col}".`;
            } else if (action === 'lowercase') {
                await run(`UPDATE dataset SET "${col}" = LOWER("${col}")`);
                message = `Done! Converted "${col}" to lowercase.`;
            } else if (action === 'uppercase') {
                await run(`UPDATE dataset SET "${col}" = UPPER("${col}")`);
                message = `Done! Converted "${col}" to uppercase.`;
            }
            break;
        }

        case 'filter_data': {
            const condition = params.condition;
            try {
                await run(`DELETE FROM dataset WHERE NOT (${condition})`);
                const countAfter = (await all('SELECT COUNT(*) AS cnt FROM dataset'))[0].cnt;
                const removed = Number(countBefore) - Number(countAfter);
                message = `Done! Applied filter "${condition}". Removed ${removed} row(s).`;
            } catch (e) {
                console.error('Filter error:', e);
                throw new Error(`Invalid filter condition: ${condition}`);
            }
            break;
        }

        case 'sort_data': {
            const col = params.column;
            const order = params.order || 'ASC';
            await run(`CREATE TABLE dataset_sorted AS SELECT * FROM dataset ORDER BY "${col}" ${order}`);
            await run('DROP TABLE dataset');
            await run('ALTER TABLE dataset_sorted RENAME TO dataset');
            message = `Done! Sorted dataset by "${col}" ${order}.`;
            break;
        }

        case 'export_data': {
            message = "EXPORT_SIGNAL";
            return { message, updatedData: [] };
        }

        default:
            throw new Error(`Unknown operation: ${operation}`);
    }

    // Read final data from DuckDB
    const updatedData = await all('SELECT * FROM dataset');

    // Save back to CSV using Node.js (avoids DuckDB file locking on Windows)
    if (updatedData.length > 0) {
        const headers = Object.keys(updatedData[0]);
        const csvLines = [headers.join(',')];
        for (const row of updatedData) {
            csvLines.push(headers.map(h => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                const str = String(val);
                // Escape commas and quotes in CSV values
                return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
            }).join(','));
        }
        const nativePath = filePath.replace(/\//g, path.sep);
        fs.writeFileSync(nativePath, csvLines.join('\n'), 'utf8');
        console.log('[Transform] Saved CSV to:', nativePath);
    }

    console.log('[Transform] Complete:', message);
    return { message, updatedData };
}

// ============================================================
// CHAT ROUTE - AI Intent Classification
// ============================================================
app.post('/api/chat', async (req, res) => {
    const { sessionId, query } = req.body;

    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid or expired session' });
    }

    const sessionData = sessions.get(sessionId);
    const filePath = sessionData.filePath.replace(/\\/g, '/');

    try {
        // Step 1: Ask AI to classify intent
        const classifyPrompt = `You are a data analysis assistant. Classify the user's request into ONE of three categories: query, transform, or visualize.

Available columns: ${sessionData.schema.join(', ')}
User request: "${query}"

1. CATEGORY: visualize
Use this if the user wants to see a CHART, GRAPH, or PLOT.
Example: "show a bar chart", "plot sales", "pie chart of status".
Respond ONLY with: {"type": "visualize", "chartType": "<bar|line|pie|area>", "xAxis": "<col>", "yAxis": "<col_or_none>", "aggregate": "<sum|avg|count|none>"}
RULES for visualize:
- xAxis MUST be a valid column name from the list. NEVER use "none" for xAxis. Pick the most logical category or date column.
- yAxis can be "none" if aggregate is "count".
- VALUES in JSON must be simple column names. DO NOT include SQL or explanations.

2. CATEGORY: transform
Use this ONLY if the user wants to MODIFY the data (rename, drop, fill nulls, cleanup, filter, sort, export).
Examples:
- "filter where price > 100" -> {"type": "transform", "operation": "filter_data", "condition": "price > 100"}
- "sort by date desc" -> {"type": "transform", "operation": "sort_data", "column": "date", "order": "DESC"}
- "download csv" -> {"type": "transform", "operation": "export_data"}
Respond with: {"type": "transform", "operation": "<op>", ...}

3. CATEGORY: query
Use this ONLY for verbal questions or general data exploration.
Respond with: {"type": "query"}

RULES:
- If the user mentions "chart", "plot", "graph", or "visualize", ALWAYS choose Category 1.
- For visualize: Axis names MUST match available columns exactly. 
- Return ONLY raw JSON.`;

        const classifyResult = await groq.chat.completions.create({
            messages: [{ role: 'user', content: classifyPrompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
        });

        let intentRaw = classifyResult.choices[0]?.message?.content?.trim() || '{"type": "query"}';
        console.log('AI Intent Raw:', intentRaw);

        // Extract JSON from markdown if needed
        const jsonMatch = intentRaw.match(/```json?\n([\s\S]*?)\n```/) || intentRaw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            intentRaw = jsonMatch[1] || jsonMatch[0];
        }

        let intent;
        try {
            intent = JSON.parse(intentRaw.trim());
        } catch (e) {
            console.error('Failed to parse intent, defaulting to query:', e.message);
            intent = { type: 'query' };
        }

        console.log('Parsed Intent:', intent);

        // ---- TRANSFORM PATH ----
        if (intent.type === 'transform') {
            console.log(`Executing transform: ${intent.operation}`, intent);

            // Special case for data health check (doesn't modify DuckDB table)
            if (intent.operation === 'data_health') {
                const health = calculateHealth(sessionData.data);
                const answer = `📊 **Data Health Report**
- **Health Score**: ${health.healthScore}/100 (${health.grade})
- **Missing Values**: ${health.missingPercent}%
- **Duplicates**: ${health.duplicatePercent}%
- **Outliers**: ${health.outlierPercent}%

The health score is calculated based on completeness, uniqueness, and statistical variance in your dataset.`;

                return res.json({
                    answer,
                    type: 'transform',
                    healthData: health
                });
            }

            const result = await executeTransform(intent.operation, intent, filePath);

            if (result.message === "EXPORT_SIGNAL") {
                return res.json({
                    answer: `I've prepared your download. Click the button below to export the data.`,
                    type: 'export',
                    downloadUrl: `http://localhost:5000/api/export/${sessionId}`
                });
            }

            // Update session data with new data
            const freshData = result.updatedData;
            sessionData.data = freshData;
            sessionData.schema = freshData.length > 0 ? Object.keys(freshData[0]) : sessionData.schema;

            // Use a replacer for BigInt serialization
            const responsePayload = JSON.stringify({
                answer: result.message,
                type: 'transform',
                updatedData: freshData,
            }, (key, value) => typeof value === 'bigint' ? value.toString() : value);

            res.setHeader('Content-Type', 'application/json');
            return res.send(responsePayload);
        }

        // ---- VISUALIZE PATH ----
        if (intent.type === 'visualize') {
            console.log(`[Visualize] Attempting: ${intent.chartType}`, intent);

            try {
                const db = new duckdb.Database(':memory:');
                const con = db.connect();
                const all = (sql) => new Promise((resolve, reject) => {
                    con.all(sql, (err, rows) => err ? reject(err) : resolve(rows));
                });
                const exec = (sql) => new Promise((resolve, reject) => {
                    con.run(sql, (err) => err ? reject(err) : resolve());
                });

                // Load data into DuckDB
                const normalizedPath = sessionData.filePath.replace(/\\/g, '/');
                await exec(`CREATE TABLE dataset AS SELECT * FROM read_csv_auto('${normalizedPath}', ignore_errors=true);`);

                const columns = sessionData.schema;

                // Deep Axial Intelligence - Fuzzy & Case-Insensitive Matching
                const findColumn = (query) => {
                    if (!query || query === 'none') return null;
                    const clean = query.toLowerCase().trim();
                    // 1. Exact or Case-insensitive match
                    const exact = columns.find(c => c.toLowerCase() === clean);
                    if (exact) return exact;
                    // 2. Contains match
                    const contains = columns.find(c => c.toLowerCase().includes(clean));
                    if (contains) return contains;
                    return null;
                };

                let xAxis = findColumn(intent.xAxis);
                let yAxis = findColumn(intent.yAxis);
                let agg = (intent.aggregate === 'none' || !intent.aggregate) ? null : intent.aggregate;

                // Smart X-Axis Discovery
                if (!xAxis) {
                    xAxis = columns.find(c => {
                        const low = c.toLowerCase();
                        return low.includes('name') || low.includes('entity') || low.includes('title') || low.includes('year') || low.includes('date') || low.includes('code');
                    }) || columns[0] || 'index';
                    console.log(`[Visualize] Axial Intelligence Fallback (X): ${xAxis}`);
                }

                // Smart Y-Axis Discovery for counts/aggregates
                if (!yAxis && (!agg || agg === 'none')) {
                    // Look for the first percentage or numeric column if user didn't specify
                    yAxis = columns.find(c => c.includes('%') || c.toLowerCase().includes('count') || c.toLowerCase().includes('score')) || null;
                }

                if (yAxis && !columns.includes(yAxis)) {
                    yAxis = findColumn(yAxis) || null;
                    if (!yAxis) agg = 'count';
                }

                let sql = '';
                if (agg && agg !== 'none' && yAxis) {
                    sql = `SELECT "${xAxis}" as name, ${agg}("${yAxis}") as value FROM dataset GROUP BY "${xAxis}" ORDER BY "${xAxis}" ASC LIMIT 50`;
                } else if (agg === 'count' || !yAxis) {
                    sql = `SELECT "${xAxis}" as name, COUNT(*) as value FROM dataset GROUP BY "${xAxis}" ORDER BY value DESC LIMIT 15`;
                } else {
                    sql = `SELECT "${xAxis}" as name, "${yAxis}" as value FROM dataset LIMIT 100`;
                }

                console.log('[Visualize] SQL:', sql);
                const chartData = await all(sql);

                // For Visualization, we convert BigInt to Number for Recharts compatibility
                const responsePayload = JSON.stringify({
                    answer: `I've prepared a ${intent.chartType || 'bar'} chart showing "${yAxis || 'record counts'}" by "${xAxis}".`,
                    type: 'visualize',
                    chartData,
                    config: {
                        type: intent.chartType || 'bar',
                        xAxis: 'name',
                        yAxis: 'value',
                        title: `${(agg && agg !== 'none') ? agg.toUpperCase() + ' of ' : ''}${yAxis || 'Record Count'} by ${xAxis}`
                    }
                }, (key, value) => typeof value === 'bigint' ? Number(value) : value);

                res.setHeader('Content-Type', 'application/json');
                return res.send(responsePayload);

            } catch (vizErr) {
                console.error('[Visualize] Error:', vizErr);
                return res.json({
                    answer: `I tried to create that chart, but encountered an issue with the mapping. Would you like to try a different visualization?`,
                    type: 'query'
                });
            }
        }

        // ---- QUERY PATH (read-only, existing logic) ----
        const sqlPrompt = `You are an expert data analyst.
I have a table named 'dataset' with the following columns: ${sessionData.schema.join(', ')}.
The user asks: "${query}"

RULES:
1. ONLY return a raw SELECT SQL query. No markdown formatting, no explanations, no extra text.
2. You are FORBIDDEN from using INSERT, UPDATE, DELETE, DROP, ALTER, or TRUNCATE commands.
3. If the user asks to describe the dataset, use queries like SELECT * FROM dataset LIMIT 10.
4. If the user asks about nulls, use CASE WHEN column IS NULL THEN 1 ELSE 0 END patterns.
5. If the user asks about data types or column info, use DESCRIBE dataset or PRAGMA table_info('dataset').
6. Always use the table name 'dataset'.`;

        const sqlResult = await groq.chat.completions.create({
            messages: [{ role: 'user', content: sqlPrompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
        });
        let sqlQuery = sqlResult.choices[0]?.message?.content?.trim() || '';
        console.log('Original AI Response:', sqlQuery);

        // Extract SQL from markdown blocks if present
        const sqlMatch = sqlQuery.match(/```sql\n([\s\S]*?)\n```/) || sqlQuery.match(/```([\s\S]*?)```/);
        if (sqlMatch) {
            sqlQuery = sqlMatch[1].trim();
        } else {
            sqlQuery = sqlQuery.replace(/```sql/gi, '').replace(/```/g, '').trim();
        }

        // Safety check
        if (/^(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)/i.test(sqlQuery)) {
            return res.json({ answer: 'Sorry, I can only answer questions about your data. I cannot modify it directly. Try asking me to "remove duplicates", "fill nulls", or "remove null rows" instead!', sql: sqlQuery });
        }

        console.log('Cleaned SQL Query:', sqlQuery);

        // Execute SELECT query
        const db = new duckdb.Database(':memory:');
        const con = db.connect();

        // Helper to run SQL
        const exec = (sql) => new Promise((resolve, reject) => {
            con.run(sql, (err) => err ? reject(err) : resolve());
        });

        // Load CSV into DuckDB with more robust options
        try {
            await exec(`CREATE OR REPLACE TABLE dataset AS SELECT * FROM read_csv_auto('${normalizedPath}', ignore_errors=true);`);
        } catch (setupErr) {
            console.error('DuckDB Setup Error:', setupErr);
            // Fallback for tricky paths: try relative path from CWD
            try {
                const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
                await exec(`CREATE OR REPLACE TABLE dataset AS SELECT * FROM read_csv_auto('${relPath}', ignore_errors=true);`);
            } catch (fallbackErr) {
                console.error('DuckDB Fallback Error:', fallbackErr);
                throw new Error(`Data access failed. Please try re-uploading the file. Details: ${setupErr.message}`);
            }
        }

        const queryResult = await new Promise((resolve, reject) => {
            con.all(sqlQuery, (err, result) => {
                if (err) { console.error('SQL Execution Error:', err); reject(err); }
                else resolve(result);
            });
        });

        console.log('Query Result:', queryResult);

        // Generate natural language answer
        const serializedData = JSON.stringify(queryResult, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        );

        const englishPrompt = `The user asked: "${query}"
The database returned the following result: ${serializedData}
Provide a clear, concise, and natural language answer to the user's question based on this result. Do not mention the SQL query or the database. If the result contains tabular data, present it in a readable format.`;

        const englishResult = await groq.chat.completions.create({
            messages: [{ role: 'user', content: englishPrompt }],
            model: 'llama-3.1-8b-instant',
            temperature: 0,
        });
        const finalAnswer = englishResult.choices[0]?.message?.content?.trim() || '';

        res.json({
            answer: finalAnswer,
            sql: sqlQuery,
            type: 'query',
        });
    } catch (error) {
        console.error('Error processing query:', error);
        res.status(500).json({ error: 'Failed to process query with AI or Database' });
    }
});

app.get('/api/export/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (!sessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found or expired' });
    }
    const sessionData = sessions.get(sessionId);
    const filePath = path.resolve(sessionData.filePath);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File no longer exists on server' });
    }

    res.download(filePath, 'transformed_data.csv', (err) => {
        if (err) {
            console.error('Download error:', err);
            // Don't send status 500 here if headers already sent
        }
    });
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Catch-all to serve React index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
