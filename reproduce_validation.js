"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var validation_1 = require("./src/lib/validation");
// Mock Zod error to test validateData fix
var invalidData = {
    title: 'Test',
    amount: 0,
    type: 'expense',
    category: 'Food',
    date: new Date().toISOString(),
    currency: 'IDR'
};
try {
    var result = (0, validation_1.validateData)(validation_1.TransactionSchema, invalidData);
    console.log('Result for amount=0:', JSON.stringify(result, null, 2));
}
catch (e) {
    console.error('Crashed:', e);
}
var missingFields = {
    title: 'Test',
    amount: 100
};
try {
    var result2 = (0, validation_1.validateData)(validation_1.TransactionSchema, missingFields);
    console.log('Result for missing fields:', JSON.stringify(result2, null, 2));
}
catch (e) {
    console.error('Crashed2:', e);
}
