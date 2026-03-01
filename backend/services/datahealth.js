// backend/services/dataHealth.js

function calculateHealth(data) {
    if (!data || data.length === 0) {
        return { error: "Empty dataset" };
    }

    const totalRows = data.length;
    const columns = Object.keys(data[0]);

    let missingCount = 0;
    let duplicateCount = 0;
    let numericValues = [];
    let seenRows = new Set();

    data.forEach(row => {
        // Missing values
        columns.forEach(col => {
            if (row[col] === null || row[col] === "" || row[col] === undefined) {
                missingCount++;
            }

            // Collect numeric values
            if (typeof row[col] === "number") {
                numericValues.push(row[col]);
            }
        });

        // Duplicate check
        const rowString = JSON.stringify(row);
        if (seenRows.has(rowString)) {
            duplicateCount++;
        } else {
            seenRows.add(rowString);
        }
    });

    const totalCells = totalRows * columns.length;

    const missingPercent = (missingCount / totalCells) * 100;
    const duplicatePercent = (duplicateCount / totalRows) * 100;

    // Outlier detection (simple IQR)
    numericValues.sort((a, b) => a - b);

    const q1 = numericValues[Math.floor(numericValues.length * 0.25)];
    const q3 = numericValues[Math.floor(numericValues.length * 0.75)];
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers = numericValues.filter(
        val => val < lowerBound || val > upperBound
    );

    const outlierPercent =
        numericValues.length > 0
            ? (outliers.length / numericValues.length) * 100
            : 0;

    // Score calculation
    const penalty =
        missingPercent * 0.5 +
        duplicatePercent * 1 +
        outlierPercent * 0.3;

    const healthScore = Math.max(0, 100 - penalty);

    let grade = "Poor";
    if (healthScore >= 85) grade = "Excellent";
    else if (healthScore >= 70) grade = "Good";
    else if (healthScore >= 50) grade = "Moderate";

    return {
        healthScore: healthScore.toFixed(2),
        grade,
        missingPercent: missingPercent.toFixed(2),
        duplicatePercent: duplicatePercent.toFixed(2),
        outlierPercent: outlierPercent.toFixed(2)
    };
}

module.exports = calculateHealth;