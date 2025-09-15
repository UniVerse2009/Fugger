// indicators.js
function getCloses(ohlcv) {
	return ohlcv.map(candle => candle[4]);
}

// Simple Moving Average
function SMA(data, period) {
	if (period <= 0) throw new Error("Period harus lebih dari 0!");
	return data.map((_, i, arr) => {
		if (i < period - 1) return null; // biar panjang sama
		const slice = arr.slice(i - period + 1, i + 1);
		const sum = slice.reduce((a, b) => a + b, 0);
		return sum / period;
	});
}

// Exponential Moving Average
function EMA(data, period) {
	if (period <= 0) throw new Error("Period harus lebih dari 0!");
	const k = 2 / (period + 1);
	let emaPrev = data[0];
	return data.map((price, i) => {
		if (i === 0) return emaPrev;
		emaPrev = price * k + emaPrev * (1 - k);
		return emaPrev;
	});
}

// MACD
function MACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
	const shortEma = EMA(data, shortPeriod);
	const longEma = EMA(data, longPeriod);

	const macdLine = data.map((_, i) => {
		if (shortEma[i] === null || longEma[i] === null) return null;
		return shortEma[i] - longEma[i];
	});

	const signalLine = EMA(macdLine.filter(v => v !== null), signalPeriod);
	const histogram = macdLine.map((val, i) => {
		if (val === null || signalLine[i] === undefined) return null;
		return val - signalLine[i];
	});

	return { macdLine, signalLine, histogram };
}

// Bollinger Bands
function BOLL(data, period = 20, multiplier = 2) {
	const sma = SMA(data, period);
	return sma.map((mean, i) => {
		if (mean === null) return { upper: null, middle: null, lower: null };

		const slice = data.slice(i - period + 1, i + 1);
		const variance = slice.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / period;
		const stddev = Math.sqrt(variance);

		return {
			upper: mean + multiplier * stddev,
			middle: mean,
			lower: mean - multiplier * stddev
		};
	});
}

module.exports = {
	getCloses,
	SMA,
	EMA,
	MACD,
	BOLL
};

