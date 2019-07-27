/* This file creates random Binarify formats, generates valid random input data for them, and tests if they are encoded and decoded properly. */

const { performance } = require('perf_hooks');
const Binarify = require('../src/binarify.js');

// Nice rip from: https://gist.github.com/nicbell/6081098
Object.compare = function (obj1, obj2) {
	//Loop through properties in object 1
	for (var p in obj1) {
		//Check property exists on both objects
		if (obj1.hasOwnProperty(p) !== obj2.hasOwnProperty(p)) return false;
 
		switch (typeof (obj1[p])) {
			//Deep compare objects
			case 'object':
				if (!Object.compare(obj1[p], obj2[p])) return false;
				break;
			//Compare function code
			case 'function':
				if (typeof (obj2[p]) == 'undefined' || (p != 'compare' && obj1[p].toString() != obj2[p].toString())) return false;
				break;
			//Compare values
			default:
				if (obj1[p] != obj2[p]) return false;
		}
	}
 
	//Check object 2 for any extra properties
	for (var p in obj2) {
		if (typeof (obj1[p]) == 'undefined') return false;
	}
	return true;
};

let numberTypes = ["u8", "u16", "u24", "u32", "s8", "s16", "s24", "s32", "f32", "f64"];
let numberTypeRanges = {
    u8: [0, 256],
    u16: [0, 256**2],
    u24: [0, 256**3],
    u32: [0, 256**4],
    s8: [-256/2, 256/2],
    s16: [-(256**2)/2, 256**2/2],
    s24: [-(256**3)/2, 256**3/2],
    s32: [-(256**4)/2, 256**4/2],
    f32: [-16777217, 16777217],
    f64: [-9007199254740992, 9007199254740992]
};

function randomIntInRange(low, high, funcOverride) { //high: exclusive
    let rnd = funcOverride || Math.random;

    return Math.floor(rnd() * (high - low)) + low;
}

function randomBoolean() {
    return Math.random() < 0.5;
}

function randomItemInArr(arr) {
    return arr[(Math.random() * arr.length) | 0];
}

function randomQuad() {
    return Math.random() ** 2;
}

function randomCubic() {
    return Math.random() ** 3;
}

function generateRandomUtf8String(len) {
    let possible = `0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"=)%&"=$][]{[%)€€€öüöäüßßß`;
    let output = "";
    
    for (let i = 0; i < len; i++) {
        output += possible.charAt((Math.random() * possible.length) | 0);
    }

    return output;
}

function generateRandomHexString(len) {
    let possible = `0123456789abcdef`;
    let output = "";
    
    for (let i = 0; i < len; i++) {
        output += possible.charAt((Math.random() * possible.length) | 0);
    }

    return output;
}

function generateRandomKey(len) {
    let possible = `abcdefghijklmnopqrstuvwxyz`;
    let output = "";
    
    for (let i = 0; i < len; i++) {
        output += possible.charAt((Math.random() * possible.length) | 0);
    }

    return output;
}

let stuff = new ArrayBuffer(8);
let view = new DataView(stuff);

function generateRandomNumberByType(type) {
    if (type === "f32") {
        let exp = randomIntInRange(-126, 128);
        let mantissa = 1 + Math.random();

        let num = mantissa * 2**exp;
        if (Math.random() < 0.5) num *= -1;

        view.setFloat32(0, num, true);
        return view.getFloat32(0, true); // make sure its an f32
    } else if (type === "f64") {
        let exp = randomIntInRange(-1022, 1024);
        let mantissa = 1 + Math.random();

        let num = mantissa * 2**exp;
        if (Math.random() < 0.5) num *= -1;

        return num;
    } else {
        return randomIntInRange(numberTypeRanges[type][0], numberTypeRanges[type][1]);
    }
}

function generateRandomNumberType() {
    return {
        str: numberTypes[(Math.random() * numberTypes.length) | 0]
    };
}

function generateRandomNumberConverter() {
    let type = generateRandomNumberType();

    let arg = type.str;
    // 10% chance to pass no argument
    if (Math.random() < 0.1) arg = undefined;

    return { type, arg, name: "number" };
}

function generateRandomBooleanConverter() {
    return { name: "boolean" };
}

function generateRandomStringConverter() {
    let maxSize;
    if (Math.random() < 0.5) {
        maxSize = randomItemInArr(numberTypes);

        if (Math.random() < 0.15) maxSize = "nullTerminated";
    } else {
        maxSize = randomIntInRange(0, 10000, randomCubic);
    }

    let arg = maxSize;
    if (Math.random() < 0.1) arg = undefined;

    return { maxSize, arg, name: "string" };
}

function generateRandomHexStringConverter() {
    let maxSize;
    if (Math.random() < 0.5) {
        maxSize = randomItemInArr(numberTypes);
    } else {
        maxSize = randomIntInRange(0, 10000, randomCubic);
    }

    return { maxSize, name: "hexString" };
}

function generateRandomObjectConverter(depth) {
    let loose = Math.random() < 0.5;
    if (Math.random() < 0.1) loose = undefined;
    let keyCount = randomIntInRange(0, 20, randomCubic);
    let obj = {};

    for (let i = 0; i < keyCount; i++) {
        let keyName = generateRandomKey(6);
        obj[keyName] = generateRandomConverter(depth + 1);
    }

    return { loose, obj, name: "object" };
}

function generateRandomArrayConverter(depth) {
    let noNesting = Math.random() < 0.333;
    let element = noNesting? randomItemInArr(dataConverters)(depth + 1) : generateRandomConverter(depth + 1);

    let maxSize;
    if (Math.random() < 0.5) {
        maxSize = randomItemInArr(numberTypes);
    } else {
        maxSize = randomIntInRange(0, noNesting? 100 : 20, randomCubic);
    }

    return { element, maxSize, noNesting, name: "array" };
}

function generateRandomTupleConverter(depth) {
    let elements = [];

    let elementCount = randomIntInRange(0, 30, randomCubic);
    for (let i = 0; i < elementCount; i++) {
        elements.push(generateRandomConverter(depth + 1));
    }

    return { elements, name: "tuple" };
}

function generateRandomDynamicConverter(depth) {
    let pairs = {};

    let pairCount = randomIntInRange(1, 100, randomQuad);
    for (let i = 0; i < pairCount; i++) {
        let key = generateRandomKey(8);
        pairs[key] = (Math.random() < 0.9)? generateRandomConverter(depth + 1) : null;
    }

    return { pairs, name: "dynamic" };
}

let serializable = [1, 5, -234626, 0.0005284, 19434, null, false, true, "usxerhits", "", "9xm89nxw4nxw4 ovsdihu hsu ", [1,6,4], [], {}, {a: "hello", b: "bye"}, {a: [32,6,false, true, "siuerhxsuirt", {g: true}], b: {yes: "no"}}];
let notSerializabe = [setTimeout, Math, String, ArrayBuffer];

function generateRandomSetElementConverter() {
    let noSerialize = Math.random() < 0.25;

    let ref = noSerialize? notSerializabe : serializable;
    let arr = [];
    for (let elem of ref) {
        if (Math.random() < 0.5) continue;
        arr.push(elem);
    }
    if (arr.length === 0) arr.push(randomItemInArr(ref));

    return { arr, noSerialize, name: "setElement" };
}

function generateRandomBitFieldConverter() {
    let bits = randomIntInRange(0, 100);

    let keys = [];
    for (let i = 0; i < bits; i++) {
        keys.push(generateRandomKey(8));
    }

    return { keys, name: "bitField" };
}

function generateRandomNullWrapperConverter(depth) {
    let arg = undefined;
    if (Math.random() < 0.8) arg = generateRandomConverter(depth);

    return { arg, name: "nullWrapper" };
}

function generateConverter(converterObj) {
    let name = converterObj.name;

    switch (name) {
        case "number": {
            return new Binarify.Number(converterObj.arg);
        }; break;
        case "boolean": {
            return new Binarify.Boolean();
        }; break;
        case "string": {
            return new Binarify.String(converterObj.arg);
        }; break;
        case "hexString": {
            return new Binarify.HexString(converterObj.maxSize);
        }; break;
        case "object": {
            let obj = {};

            for (let key in converterObj.obj) {
                obj[key] = generateConverter(converterObj.obj[key]);
            }

            return new Binarify.Object(obj, converterObj.loose);
        }; break;
        case "array": {
            return new Binarify.Array(generateConverter(converterObj.element), converterObj.maxSize);
        }; break;
        case "tuple": {
            let arr = [];

            for (let i = 0; i < converterObj.elements.length; i++) {
                arr.push(generateConverter(converterObj.elements[i]));
            }

            return new Binarify.Tuple(arr);
        }; break;
        case "dynamic": {
            let obj = {};

            for (let key in converterObj.pairs) {
                obj[key] = (converterObj.pairs[key] !== null)? generateConverter(converterObj.pairs[key]) : null;
            }

            return new Binarify.Dynamic(obj);
        }; break;
        case "setElement": {
            return new Binarify.SetElement(converterObj.arr, converterObj.noSerialize);
        }; break;
        case "bitField": {
            return new Binarify.BitField(converterObj.keys);
        }; break;
        case "nullWrapper": {
            if (converterObj.arg) return new Binarify.NullWrapper(generateConverter(converterObj.arg));
            else return new Binarify.NullWrapper()
        }; break;
    }
}

function generateRandomValue(converterObj) {
    let name = converterObj.name;

    if (name === "number") {
        return generateRandomNumberByType(converterObj.type.str);
    } else if (name === "boolean") {
        return randomBoolean();
    } else if (name === "string") {
        let len;

        if (typeof converterObj.maxSize === "number") {
            len = converterObj.maxSize;
        } else {
            if (converterObj.maxSize === "nullTerminated") {
                len = randomIntInRange(0, 10000, randomCubic);
            } else {
                let max = numberTypeRanges[converterObj.maxSize][1];
                max = Math.min(10000, max);

                len = randomIntInRange(0, max, randomCubic);
            }
        }

        return generateRandomUtf8String(len);
    } else if (name === "hexString") {
        let len;

        if (typeof converterObj.maxSize === "number") {
            len = converterObj.maxSize;
        } else {
            let max = numberTypeRanges[converterObj.maxSize][1];
            max = Math.min(10000, max);

            len = randomIntInRange(0, max, randomCubic);
        }

        return generateRandomHexString(len);
    } else if (name === "object") {
        let obj = {};

        for (let key in converterObj.obj) {
            if (converterObj.loose && Math.random() < 0.25) continue;

            obj[key] = generateRandomValue(converterObj.obj[key]);
        }

        return obj;
    } else if (name === "array") {
        let arr = [], len;

        if (typeof converterObj.maxSize === "number") {
            len = converterObj.maxSize;
        } else {
            let max = numberTypeRanges[converterObj.maxSize][1];
            max = Math.min(converterObj.noNesting? 100 : 20, max);

            len = randomIntInRange(0, max, randomCubic);
        }

        for (let i = 0; i < len; i++) {
            arr.push(generateRandomValue(converterObj.element));
        }

        return arr;
    } else if (name === "tuple") {
        let arr = [];

        for (let i = 0; i < converterObj.elements.length; i++) {
            arr.push(generateRandomValue(converterObj.elements[i]));
        }

        return arr;
    } else if (name === "dynamic") {
        let keys = Object.keys(converterObj.pairs);
        let key = randomItemInArr(keys);

        return { key: key, value: converterObj.pairs[key] === null ? null : generateRandomValue(converterObj.pairs[key]) };
    } else if (name === "setElement") {
        return randomItemInArr(converterObj.arr);
    } else if (name === "bitField") {
        let field = {};

        for (let i = 0; i < converterObj.keys.length; i++) {
            field[converterObj.keys[i]] = randomBoolean();
        }

        return field;
    } else if (name === "nullWrapper") {
        let val;

        if (converterObj.arg) {
            if (Math.random() < 0.333) val = null;
            else val = generateRandomValue(converterObj.arg);
        } else {
            val = null;
        }

        return val;
    }
}

let structuralConverters = [generateRandomObjectConverter, generateRandomArrayConverter, generateRandomTupleConverter, generateRandomDynamicConverter];
let dataConverters = [generateRandomBooleanConverter, generateRandomNumberConverter, generateRandomStringConverter, generateRandomHexStringConverter, generateRandomSetElementConverter, generateRandomBitFieldConverter, generateRandomNullWrapperConverter];

function generateRandomConverter(depth) {
    let chanceForStructuralType = Math.pow(Math.E, -depth) * 0.98;

    if (Math.random() < chanceForStructuralType) {
        return randomItemInArr(structuralConverters)(depth);
    } else {
        return randomItemInArr(dataConverters)(depth);
    }
}

let structure;

function probe() {
    let value = generateRandomValue(structure);
    let converter = generateConverter(structure);

    let start = performance.now();
    let encoded = Binarify.encode(converter, value);
    let decoded = Binarify.decode(converter, encoded);
    let time = performance.now() - start;

    let compareTime = performance.now();
    //JSON.parse(JSON.stringify(value));
    let compareTimeEnd = performance.now() - compareTime;

    let success;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
        success = JSON.stringify(value) === JSON.stringify(decoded);
    } else {
        success = Object.compare(value, decoded);
    }

    return {
        input: value,
        output: decoded,
        success: success,
        bytes: encoded.byteLength,
        time: time,
        compareTime: compareTimeEnd,
        //structure: structure
    };
}

function run() {
    let passed = true;
    for (let i = 0; i < 1e3; i++) {
        structure = generateRandomConverter(0);

        let status = probe();
        if (!status.success) {
            console.error("FAIL!");
            console.log(status);
            console.log(structure);
            passed = false;
            break;
        }

        console.log(i);
    }

    if (passed) console.log("Passed!");
}

run();