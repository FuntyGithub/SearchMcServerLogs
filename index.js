const fs = require('node:fs');
const zlib = require('node:zlib');
const readline = require('node:readline');
const glob = require('glob').glob;
const prompts = require('prompts');
let equalOrContain, searchString;

async function processGzipFile(filePath) {
    const gunzip = zlib.createGunzip();
    const rl = readline.createInterface({
        input: gunzip,
        crlfDelay: Infinity
    });

    const outputLines = [];
    let fileName = filePath.split('/').pop() && filePath.split('\\').pop();
    rl.on('line', (line) => {
        if (equalOrContain === 'contain') {
            if (line.includes(searchString)) outputLines.push(fileName + ": " + line);
        } else {
            if (line === searchString) outputLines.push(fileName + ": " + line);
        }
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(gunzip);

    await new Promise((resolve, reject) => {
        rl.on('close', resolve);
        rl.on('error', reject);
    });

    return outputLines;
}

async function processFiles(searchFolder) {
    console.log(`Searching for files in ${searchFolder}`);
    const gzipFiles = await glob(`${searchFolder}/**/*.gz`)
    const latestLogFile = `${searchFolder}/latest.log`;

    console.log(`Searching through ${gzipFiles.length} files...`);

    const allMatchingLines = [];
    for (const file of gzipFiles) {
        const matchingLines = await processGzipFile(file, searchString);
        allMatchingLines.push(...matchingLines);
    }

    if (fs.existsSync(latestLogFile)) {
        const latestLogLines = fs.readFileSync(latestLogFile, 'utf-8').split('\n');
        allMatchingLines.push(...latestLogLines.filter(line => equalOrContain === 'contain' ? line.includes(searchString) : line === searchString).map(line => 'latest.log: ' + line));
    }

    return allMatchingLines;
}

(async () => {
    const response = await prompts(
        [
            {
                type: 'text',
                name: 'searchFolder',
                message: 'What folder do you want to search in?',
                validate: path => fs.existsSync(path) ? true : 'Path does not exist'
            },
            {
                type: 'text',
                name: 'searchString',
                message: 'What string do you want to search for?'
            },
            {
                type: 'select',
                name: 'equalOrContain',
                message: 'Should the search string be an exact match or contain the search string?',
                choices: [
                    { title: 'Contain', value: 'contain' },
                    { title: 'Exact match', value: 'exact' }
                ]
            },
            {
                type: 'text',
                name: 'outputFile',
                message: 'What should the output file be called?',
                initial: 'output.txt'
            },
            {
                type: 'text',
                name: 'outputPath',
                message: 'Where should the output file be saved?',
                initial: process.cwd(),
                validate: path => fs.existsSync(path) ? true : 'Path does not exist'
            }
        ],
        {
            onCancel: () => {
                console.log('Process cancelled.');
                process.exit(0);
            }
        }
    );

    try {
        searchString = response.searchString;
        equalOrContain = response.equalOrContain;
        const matchingLines = await processFiles(response.searchFolder);
        console.log(`Found ${matchingLines.length} matching lines!`);

        fs.writeFileSync(response.outputPath + '/' + response.outputFile, matchingLines.join('\n'));
        console.log(`Matching lines written to ${response.outputFile}.`);
    } catch (error) {
        console.error('Error occurred:', error);
    }
})();