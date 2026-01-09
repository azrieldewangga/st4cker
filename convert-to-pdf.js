const fs = require('fs');
const { mdToPdf } = require('md-to-pdf');

async function convertToPDF() {
    try {
        const inputFile = 'C:\\\\Users\\\\washi\\\\.gemini\\\\antigravity\\\\brain\\\\51eb409c-3ff3-49a1-8c79-a9753e72a088\\\\implementation_plan.md';
        const outputFile = 'C:\\\\Users\\\\washi\\\\Desktop\\\\st4cker-telegram-integration-plan.pdf';

        console.log('Converting markdown to PDF...');

        const pdf = await mdToPdf({ path: inputFile }, {
            dest: outputFile,
            pdf_options: {
                format: 'A4',
                margin: '20mm',
                printBackground: true
            }
        });

        console.log(`✅ PDF created successfully at: ${outputFile}`);
    } catch (error) {
        console.error('❌ Error creating PDF:', error.message);
        process.exit(1);
    }
}

convertToPDF();
