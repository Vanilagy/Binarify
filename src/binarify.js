/*
    Binarify v3.0.2
    @Vanilagy
*/

(function() {
    "use strict";

    // Well, technically, max values + 1. I just wanna keep the name short.
    var MAX_VALUES = {
        u8:  256,
        u16: 65536,
        u24: 16777216,
        u32: 4294967296,
        s8:  256 / 2,
        s16: 65536 / 2,
        s24: 16777216 / 2,
        s32: 4294967296 / 2,
        f32: 16777217,
        f64: Number.MAX_SAFE_INTEGER
    };
    var NUMBER_TYPES = ["u8", "u16", "u24", "u32", "s8", "s16", "s24", "s32", "f32", "f64"];
    
    function getTypeByLength(length) {
        switch (length) {
            case 1: return "u8";
            case 2: return "u16";
            case 3: return "u24";
            case 4: return "u32";
            default: return "f64"; // Double can store the highest integer out of all available datatypes
        }
    }

    // Modulo that never returns negative numbers. Instead, they wrap around to the positive side again.
    function adjustedMod(n, m) {
        return ((n % m) + m) % m;
    }

    var hexRegExp = /^[0-9a-fA-F]+$/;
    function isHexString(str) {
        return hexRegExp.test(str);
    }

    function appendBytesToArray(arr, uint8Array) {
        for (var i = 0; i < uint8Array.length; i++) {
            arr.push(uint8Array[i]);
        }
    }

    var textEncoder, textDecoder;

    // The if (true ...) is based on the observation that the following polyfill is actually 50% FASTER than the native implementation. Strange.
    if (true || typeof TextEncoder === "undefined") {
        // Load them from this awesome polyfill (slightly modified) from https://github.com/anonyco/FastestSmallestTextEncoderDecoder:

        (function(window){
            "use strict";
            var log = Math.log;
            var LN2 = Math.LN2;
            var clz32 = Math.clz32 || function(x) {return 31 - log(x >>> 0) / LN2 | 0};
            var fromCharCode = String.fromCharCode;
            var Object_prototype_toString = ({}).toString;
            var NativeUint8Array = window.Uint8Array;
            var patchedU8Array = NativeUint8Array || Array;
            var ArrayBufferString = Object_prototype_toString.call((window.ArrayBuffer || patchedU8Array).prototype);
            function decoderReplacer(encoded){
              var codePoint = encoded.charCodeAt(0) << 24;
              var leadingOnes = clz32(~codePoint)|0;
              var endPos = 0, stringLen = encoded.length|0;
              var result = "";
              if (leadingOnes < 5 && stringLen >= leadingOnes) {
                codePoint = (codePoint<<leadingOnes)>>>(24+leadingOnes);
                for (endPos = 1; endPos < leadingOnes; endPos=endPos+1|0)
                  codePoint = (codePoint<<6) | (encoded.charCodeAt(endPos)&0x3f/*0b00111111*/);
                if (codePoint <= 0xFFFF) { // BMP code point
                  result += fromCharCode(codePoint);
                } else if (codePoint <= 0x10FFFF) {
                  // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                  codePoint = codePoint - 0x10000|0;
                  result += fromCharCode(
                    (codePoint >> 10) + 0xD800|0,  // highSurrogate
                    (codePoint & 0x3ff) + 0xDC00|0 // lowSurrogate
                  );
                } else endPos = 0; // to fill it in with INVALIDs
              }
              for (; endPos < stringLen; endPos=endPos+1|0) result += "\ufffd"; // replacement character
              return result;
            }
            function TextDecoder(){};
            TextDecoder.prototype.decode = function(inputArrayOrBuffer){
              var buffer = (inputArrayOrBuffer && inputArrayOrBuffer.buffer) || inputArrayOrBuffer;
              if (Object_prototype_toString.call(buffer) !== ArrayBufferString)
                throw Error("Failed to execute 'decode' on 'TextDecoder': The provided value is not of type '(ArrayBuffer or ArrayBufferView)'");
              var inputAs8 = NativeUint8Array ? new patchedU8Array(buffer) : buffer;
              var resultingString = "";
              for (var index=0,len=inputAs8.length|0; index<len; index=index+32768|0)
                resultingString += fromCharCode.apply(0, inputAs8[NativeUint8Array ? "slice" : "subarray"](index,index+32768|0));
          
              return resultingString.replace(/[\xc0-\xff][\x80-\xbf]*/g, decoderReplacer);
            }
            textDecoder = TextDecoder;
            //////////////////////////////////////////////////////////////////////////////////////
            function encoderReplacer(nonAsciiChars){
              // make the UTF string into a binary UTF-8 encoded string
              var point = nonAsciiChars.charCodeAt(0)|0;
              if (point >= 0xD800 && point <= 0xDBFF) {
                var nextcode = nonAsciiChars.charCodeAt(1)|0;
                if (nextcode !== nextcode) // NaN because string is 1 code point long
                  return fromCharCode(0xef/*11101111*/, 0xbf/*10111111*/, 0xbd/*10111101*/);
                // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                if (nextcode >= 0xDC00 && nextcode <= 0xDFFF) {
                  point = ((point - 0xD800)<<10) + nextcode - 0xDC00 + 0x10000|0;
                  if (point > 0xffff)
                    return fromCharCode(
                      (0x1e/*0b11110*/<<3) | (point>>>18),
                      (0x2/*0b10*/<<6) | ((point>>>12)&0x3f/*0b00111111*/),
                      (0x2/*0b10*/<<6) | ((point>>>6)&0x3f/*0b00111111*/),
                      (0x2/*0b10*/<<6) | (point&0x3f/*0b00111111*/)
                    );
                } else return fromCharCode(0xef, 0xbf, 0xbd);
              }
              if (point <= 0x007f) return nonAsciiChars;
              else if (point <= 0x07ff) {
                return fromCharCode((0x6<<5)|(point>>>6), (0x2<<6)|(point&0x3f));
              } else return fromCharCode(
                (0xe/*0b1110*/<<4) | (point>>>12),
                (0x2/*0b10*/<<6) | ((point>>>6)&0x3f/*0b00111111*/),
                (0x2/*0b10*/<<6) | (point&0x3f/*0b00111111*/)
              );
            }
            function TextEncoder(){};
            TextEncoder.prototype.encode = function(inputString){
              // 0xc0 => 0b11000000; 0xff => 0b11111111; 0xc0-0xff => 0b11xxxxxx
              // 0x80 => 0b10000000; 0xbf => 0b10111111; 0x80-0xbf => 0b10xxxxxx
              var encodedString = inputString === void 0 ?  "" : ("" + inputString).replace(/[\x80-\uD7ff\uDC00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]?/g, encoderReplacer);
              var len=encodedString.length|0, result = new patchedU8Array(len);
              for (var i=0; i<len; i=i+1|0)
                result[i] = encodedString.charCodeAt(i);
              return result;
            };
            textEncoder = TextEncoder;
        })(typeof global == "" + void 0 ? typeof self == "" + void 0 ? this : self : global);
    } else {
        textEncoder = TextEncoder;
        textDecoder = TextDecoder;
    }

    var textEncoderInstance = new textEncoder();
    function stringToUtf8Bytes(string) {
        return textEncoderInstance.encode(string);
    }

    var textDecoderInstance = new textDecoder();
    function utf8BytesToString(bytes) {
        return textDecoderInstance.decode(bytes);
    }
    
    // Data stored about the current decoding process.
    var index = 0,
        decodeBytes = null,
        decodeView = null;
    
    /*
        Main object, containing all converters, each with their encoding and decoding methods (used internally). It also contains the encode and decode methods meant for external use.
        
        A converter will turn whatever input is piped into its encode method into a very compact binary representation and write it to a buffer. This only works if the structure and properties of the input match those that the method expects. Calling decode will decode the binary data in decodeBytes and return it. If everything went well, the decoded data will be exactly equal to the data originally input into encode.
    */

    var Binarify = {
        version: "3.0.2", // Can be used to compare client and server

        encode: function(converter, data) {
            var buffer = [];

            converter.encode(data, buffer);

            // Convert to ArrayBuffer (or Buffer if Node)
            if (typeof Buffer !== "undefined") return Buffer.from(buffer);
            return new Uint8Array(buffer).buffer;
        },

        decode: function(converter, buffer) {
            if (typeof Buffer !== "undefined" && buffer instanceof Buffer) {
                buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); // Since Node Buffers are also instances of Uint8Array, Buffer.buffer is an ArrayBuffer. We have to do the slicing because of: https://stackoverflow.com/a/31394257/7036957
            }

            index = 0;
            decodeBytes = new Uint8Array(buffer);
            decodeView = new DataView(buffer);

            return converter.decode();
        },
        
        Boolean: function() {
            this.set = function() {return this};
            
            this.encode = function(boolean, buffer) {
                buffer.push(boolean? 1 : 0);
            };
            
            this.decode = function() {
                return decodeBytes[index++] === 1;
            };
        },
        
        Number: function(type) {
            this.set = function(typeNew) {
                // Defaults to JavaScript's default "double"
                type = typeNew || "f64";
                if (NUMBER_TYPES.indexOf(type) === -1) throw new Error("Incorrect Number type '" + type + "'.");
                
                return this;
            };
            this.set(type);

            this.encode = function(number, buffer) {
                numberHelper.write[type](number, buffer);
            };
            
            this.decode = function() {
                return numberHelper.read[type]();
            };
        },
        
        String: function(maxSize) {
            var hasExactLength, size, length;
            
            this.set = function(maxSizeNew) {
                maxSize = maxSizeNew;
                
                // Figure out if maxSize is a number or a number size
                hasExactLength = typeof maxSize === "number";

                if (!hasExactLength) {
                    // Defaults to a null-terminated string
                    size = maxSize || "nullTerminated";
                    if (size !== "nullTerminated" && NUMBER_TYPES.indexOf(size) === -1) throw new Error("Incorrect String size number type '" + size + "'.");
                } else {
                    maxSize = Math.floor(maxSize);
                    if (maxSize < 0) throw new Error("String cannot have a fixed length shorter than 0.");
                    length = maxSize;
                }
                
                return this;
            };
            this.set(maxSize);

            function findUtf8ByteLength(bytes, stringLength) {
                var index = 0;

                // Hop over the utf8
                for (var i = 0; i < stringLength; i++) {
                    var byte = bytes[index];

                    if ((byte & 0b11110000) === 0b11110000) { index += 4; continue; }
                    if ((byte & 0b11100000) === 0b11100000) { index += 3; continue; }
                    if ((byte & 0b11000000) === 0b11000000) { index += 2; continue; }
                    index += 1;
                }

                return index;
            }
            
            this.encode = function(string, buffer) {
                if (!hasExactLength) {
                    if (size === "nullTerminated") {
                        if (string.indexOf("\u0000") !== -1) string.replace(/\u0000/g, " "); // All NULL-characters will be replaced with a space

                        var bytes = stringToUtf8Bytes(string);
                        appendBytesToArray(buffer, bytes);
                        buffer.push(0);
                    } else {
                        // Prepend the string's length
                        string = string.slice(0, MAX_VALUES[size]-1);

                        numberHelper.write[size](string.length, buffer);
                        buffer.push(...stringToUtf8Bytes(string));
                    }
                } else {
                    if (string.length === length) {
                        buffer.push(...stringToUtf8Bytes(string));
                    } else {
                        throw new Error("Passed string isn't of specified length " + length + ".");
                    }
                }
            };
            
            this.decode = function() {
                var output;

                if (!hasExactLength) {
                    if (size === "nullTerminated") {
                        var nullIndex = index;
                        for (nullIndex; nullIndex < decodeBytes.length; nullIndex++) {
                            if (decodeBytes[nullIndex] === 0) break;
                        }

                        var part = decodeBytes.slice(index, nullIndex);
                        var string = utf8BytesToString(part);

                        index += (nullIndex - index) + 1;
                        output = string;
                    } else {
                        var len = numberHelper.read[size](decodeBytes);
                        var endIndex = index + findUtf8ByteLength(decodeBytes, len);
                        var part = decodeBytes.slice(index, endIndex);
                        var string = utf8BytesToString(part);

                        index += (endIndex - index);
                        output = string;
                    }
                } else {
                    var endIndex = index + findUtf8ByteLength(decodeBytes, length);
                    var part = decodeBytes.slice(index, endIndex);
                    var string = utf8BytesToString(part);

                    index += (endIndex - index);
                    output = string;
                }
                
                return output;
            };
        },
        
        HexString: function(maxSize) {
            var hasExactLength;
            
            this.set = function(maxSizeNew) {
                maxSize = maxSizeNew;

                if (typeof maxSize === "string") {
                    if (NUMBER_TYPES.indexOf(maxSize) === -1) throw new Error("Incorrect HexString size number type '" + maxSize + "'.");

                    hasExactLength = false;
                } else if (typeof maxSize === "number") {
                    maxSize = Math.floor(maxSize);
                    if (maxSize < 0) throw new Error("HexString cannot have a fixed length shorter than 0.");

                    hasExactLength = true;
                } else {
                    throw new Error("Incorrect HexString size given.");
                }
                
                return this;
            };
            this.set(maxSize);

            this.encode = function(hexString, buffer) {
                if (hexString.length > 0 && !isHexString(hexString)) throw new Error("Passed string is not a hex string.");

                if (hasExactLength) {
                    if (hexString.length !== maxSize) throw new Error("Passed string isn't of specified length " + maxSize + ".");
                } else {
                    numberHelper.write[maxSize](hexString.length, buffer);
                }

                for (var i = 0; i < hexString.length; i += 2) {
                    var nibble1 = parseInt(hexString.charAt(i), 16);
                    var nibble2 = parseInt(hexString.charAt(i + 1) || 0, 16);

                    buffer.push(nibble1 + 0x10 * nibble2);
                }
            };

            this.decode = function() {
                var length;

                if (hasExactLength) {
                    length = maxSize;
                } else {
                    length = numberHelper.read[maxSize](decodeBytes);
                }

                var hexString = "", byteLength = Math.ceil(length / 2);

                for (var i = 0; i < byteLength; i ++) {
                    var byte = decodeBytes[index + i];

                    var nibble1 = byte & 0x0F;
                    var nibble2 = byte >> 4;

                    hexString += nibble1.toString(16);
                    if (i < byteLength-1) hexString += nibble2.toString(16);
                    else if (length % 2 === 0) hexString += nibble2.toString(16);
                }

                index += byteLength;

                return hexString;
            };
        },
        
        Object: function(blueprint, loose /* If loose is set, keys in the input can be omitted */) {
            var keys, keyLengthByteType;
            
            this.set = function(blueprintNew, looseNew) {
                blueprint = blueprintNew;
                loose = looseNew;
                
                if (blueprint === undefined) return;

                keys = Object.keys(blueprint);
                keys.sort(); // This is done to guarantee key order across all JavaScript implementations

                if (loose) {
                    var keyLengthByteLength = Math.ceil(Math.log2(keys.length) / 8) || 1;            
                    keyLengthByteType = getTypeByLength(keyLengthByteLength);
                }
                
                return this;
            };
            this.set(blueprint, loose);
            
            this.encode = function(obj, buffer) {
                if (blueprint === undefined) throw new Error("Can't encode, no blueprint defined.");
                
                if (!loose) {
                    for (var i = 0; i < keys.length; i++) {
                        var key = keys[i];
                        if (obj[key] === undefined) throw new Error("Key '" + key + "' is defined in the blueprint, but not in the input object.");

                        blueprint[key].encode(obj[key], buffer);
                    }
                } else {
                    var attributeCount = 0;
                    var indexes = {};

                    for (var i = 0; i < keys.length; i++) {
                        var key = keys[i];
                        if (obj[key] === undefined) continue;

                        indexes[key] = i;
                        attributeCount++;
                    }

                    numberHelper.write[keyLengthByteType](attributeCount, buffer);

                    for (var key in indexes) {
                        numberHelper.write[keyLengthByteType](indexes[key], buffer);

                        blueprint[key].encode(obj[key], buffer);
                    }
                }
            };
            
            this.decode = function() {
                var obj = {};
            
                if (!loose) {
                    for (var i = 0; i < keys.length; i++) {
                        var key = keys[i];
                        obj[key] = blueprint[key].decode();
                    }
                } else {
                    var numberOfKeys = numberHelper.read[keyLengthByteType](decodeBytes);

                    for (var i = 0; i < numberOfKeys; i++) {
                        var key = keys[numberHelper.read[keyLengthByteType](decodeBytes)];

                        obj[key] = blueprint[key].decode();
                    }
                }
                
                return obj;
            };
        },

        Array: function(element, maxSize) {
            var hasExactLength;

            this.set = function(elementNew, maxSizeNew) {
                element = elementNew;
                maxSize = maxSizeNew;
                
                if (element === undefined) return;

                if (typeof maxSize === "string") {
                    if (NUMBER_TYPES.indexOf(maxSize) === -1) throw new Error("Incorrect Array size number type '" + maxSize + "'.");

                    hasExactLength = false;
                } else if (typeof maxSize === "number") {
                    maxSize = Math.floor(maxSize);
                    if (maxSize < 0) throw new Error("Array cannot have a fixed length shorter than 0.");

                    hasExactLength = true;
                } else {
                    throw new Error("Incorrect Array size given.");
                }
                
                return this;
            };
            this.set(element, maxSize);

            this.encode = function(arr, buffer) {
                if (element === undefined) throw new Error("Can't encode, element not specified.");

                var arrLength = arr.length;

                if (hasExactLength) {
                    if (arrLength !== maxSize) throw new Error("Passed array isn't of specified length " + maxSize + ".");
                } else {
                    if (arrLength > MAX_VALUES[maxSize]-1) arr = arr.slice(0, MAX_VALUES[maxSize]-1);
                    arrLength = arr.length;

                    // Prepend the array's length
                    numberHelper.write[maxSize](arrLength, buffer);
                }

                for (var i = 0; i < arrLength; i++) {
                    element.encode(arr[i], buffer);
                }
            };

            this.decode = function() {
                var arrLength, arr = [];

                if (hasExactLength) {
                    arrLength = maxSize;
                } else {
                    arrLength = numberHelper.read[maxSize](decodeBytes);
                }

                for (var i = 0; i < arrLength; i++) {
                    arr.push(element.decode());
                }

                return arr;
            };
        },

        Tuple: function(elements) {
            this.set = function(elementsNew) {
                if (elementsNew === undefined) return;

                elements = elementsNew;
            };
            this.set(elements);

            this.encode = function(values, buffer) {
                if (elements === undefined) throw new Error("Can't encode, no tuple specified.");

                if (values.length !== elements.length) throw new Error("Given tuple values don't match the tuple's length of " + elements.length + ".");

                for (var i = 0; i < elements.length; i++) {
                    elements[i].encode(values[i], buffer);
                }
            };

            this.decode = function() {
                var tuple = [];

                for (var i = 0; i < elements.length; i++) {
                    tuple.push(elements[i].decode());
                }

                return tuple;
            };
        },
                
        Dynamic: function(pairs) {
            var keys, keyLengthByteType;
            
            this.set = function(pairsNew) {
                pairs = pairsNew;
                
                if (pairs === undefined) return;
            
                keys = Object.keys(pairs);
                keys.sort(); // Same reasoning as in Binarify.Object

                var keyLengthByteLength = Math.ceil(Math.log2(keys.length) / 8) || 1;            
                keyLengthByteType = getTypeByLength(keyLengthByteLength); 
                
                return this;
            };
            this.set(pairs);
            
            this.encode = function(pair, buffer) {
                if (pairs === undefined) throw new Error("Can't encode, no pairs object defined.");
                
                var key = pair.key, value = pair.value;

                if (pairs[key] === undefined) throw new Error("Key '" + key + "' is not defined.");

                numberHelper.write[keyLengthByteType](keys.indexOf(key), buffer);
                if (pairs[key] !== null) {
                    pairs[key].encode(value, buffer);
                }
            };
            
            this.decode = function() {
                var key = keys[numberHelper.read[keyLengthByteType](decodeBytes)];
                
                return {
                    key: key,
                    value: (pairs[key] === null)? null : pairs[key].decode()
                };
            };
        },
        
        SetElement: function(set, noSerialization) {
            var stringifiedElements, stringifiedElementArr, keyLengthByteType;
            
            this.set = function(setNew, noSerializationNew) {
                set = setNew;
                noSerialization = noSerializationNew;
                
                if (set === undefined) return;

                if (!noSerialization) {
                    stringifiedElements = {}, stringifiedElementArr = [];
                    for (var i = 0; i < set.length; i++) {
                        try {
                            var json = JSON.stringify(set[i]);
                            if (json === undefined) throw new Error("Set element " + set[i] + " serialized to 'undefined', that's bad.");

                            stringifiedElements[json] = i;
                            stringifiedElementArr.push(json);
                        } catch(e) {
                            throw new Error("Set element " + set[i] + " couldn't be serialized.", e);
                        }
                    }
                }

                var keyLengthByteLength = Math.ceil(Math.log2(set.length) / 8) || 1;            
                keyLengthByteType = getTypeByLength(keyLengthByteLength);
                
                return this;
            };
            this.set(set, noSerialization);
            
            this.encode = function(element, buffer) {
                if (set === undefined) throw new Error("Can't encode, no set defined.");
                
                var index;
                if (noSerialization) {
                    index = set.indexOf(element);
                } else {
                    index = stringifiedElements[JSON.stringify(element)];
                }
                
                if (index !== -1 && index !== undefined) {
                    numberHelper.write[keyLengthByteType](index, buffer);
                } else {
                    throw new Error("Set element " + element + " not specified in enumeration.");
                }
            };
            
            this.decode = function() {
                var elementIndex = numberHelper.read[keyLengthByteType](decodeBytes);
                
                if (noSerialization) {
                    return set[elementIndex];
                } else {
                    return JSON.parse(stringifiedElementArr[elementIndex]);
                }
            };
        },
        
        BitField: function(attributes) {
            this.set = function(attributesNew) {
                attributes = attributesNew;
                
                return this;
            };
            
            this.encode = function(obj, buffer) {
                if (attributes === undefined) throw new Error("Can't encode, no attribute array defined.");
                
                var currentByte = 0;
                for (var i = 0; i < attributes.length; i++) {
                    if (i % 8 === 0 && i > 0) {
                        buffer.push(currentByte);
                        currentByte = 0;
                    }
                    
                    var attribute = attributes[i];
                    if (obj[attribute] !== undefined) {
                        if (obj[attribute] === true) {
                            currentByte += 1 << i % 8;
                        }
                    } else {
                        throw new Error("Attribute '" + attribute + "' is defined in the BitField, but no value was specified.");
                    }
                }
                if (attributes.length) {
                    buffer.push(currentByte);
                }
            };
            
            this.decode = function() {
                var obj = {};
                var internalIndex = 0,
                    currentByte = decodeBytes[index];
                
                for (var i = 0; i < attributes.length; i++) {
                    if (i % 8 === 0 && i > 0) {
                        internalIndex++;
                        currentByte = decodeBytes[index + internalIndex];
                    }
                    
                    obj[attributes[i]] = (currentByte & (1 << i % 8)) !== 0;
                }
                
                index += Math.floor(attributes.length / 8);
                
                return obj;
            };
        },

        NullWrapper: function(converter) {
            this.set = function(converterNew) {
                converter = converterNew;
                
                return this;
            };
            
            this.encode = function(data, buffer) {
                if (data === null || converter === undefined) {
                    buffer.push(0);
                } else {
                    buffer.push(1);
                    converter.encode(data, buffer);
                }
            };

            this.decode = function() {
                var isNull = decodeBytes[index++] === 0;

                if (isNull) {
                    return null;
                } else {
                    return converter.decode();
                }
            };
        }
    };

    var numberBuffer = new ArrayBuffer(8);
    var numberBufferBytes = new Uint8Array(numberBuffer);
    var numberBufferView = new DataView(numberBuffer);
    
    // Helper object, used to convert from and to different number types
    var numberHelper = {
        write: {
            u8: function(number, buffer) {
                numberBufferView.setUint8(0, number, true);

                buffer.push(numberBufferBytes[0]);
            },

            u16: function(number, buffer) {
                numberBufferView.setUint16(0, number, true);

                buffer.push(numberBufferBytes[0], numberBufferBytes[1]);
            },

            u24: function(number, buffer) {
                number = adjustedMod(Math.round(number), MAX_VALUES.u24);

                numberBufferView.setUint32(0, number, true);

                // We assert: numberBufferBytes[3] should always be 0. (little-endian)
                buffer.push(numberBufferBytes[0], numberBufferBytes[1], numberBufferBytes[2]);
            },

            u32: function(number, buffer) {
                numberBufferView.setUint32(0, number, true);

                buffer.push(numberBufferBytes[0], numberBufferBytes[1], numberBufferBytes[2], numberBufferBytes[3]);
            },

            s8: function(number, buffer) {
                numberBufferView.setInt8(0, number, true);

                buffer.push(numberBufferBytes[0]);
            },

            s16: function(number, buffer) {
                numberBufferView.setInt16(0, number, true);

                buffer.push(numberBufferBytes[0], numberBufferBytes[1]);
            },

            s24: function(number, buffer) {
                number = adjustedMod(Math.round(number) + MAX_VALUES.s24, MAX_VALUES.u24) - MAX_VALUES.s24;

                // Two's complement
                var readValue = number;
                if (number < 0) readValue = MAX_VALUES.u24 + number;

                numberBufferView.setUint32(0, readValue, true);

                // We assert: numberBufferBytes[1] should always be 0. (little-endian)
                buffer.push(numberBufferBytes[0], numberBufferBytes[1], numberBufferBytes[2]);
            },

            s32: function(number, buffer) {
                numberBufferView.setInt32(0, number, true);

                buffer.push(numberBufferBytes[0], numberBufferBytes[1], numberBufferBytes[2], numberBufferBytes[3]);
            },

            f32: function(number, buffer) {
                numberBufferView.setFloat32(0, number, true);

                buffer.push(numberBufferBytes[0], numberBufferBytes[1], numberBufferBytes[2], numberBufferBytes[3]);
            },

            f64: function(number, buffer) {
                numberBufferView.setFloat64(0, number, true);

                buffer.push(numberBufferBytes[0], numberBufferBytes[1], numberBufferBytes[2], numberBufferBytes[3], numberBufferBytes[4], numberBufferBytes[5], numberBufferBytes[6], numberBufferBytes[7]);
            }
        },
        read: {
            u8: function() {
                var value = decodeView.getUint8(index, true);
                index += 1;

                return value;
            },

            u16: function() {
                var value = decodeView.getUint16(index, true);
                index += 2;

                return value;
            },

            u24: function() {
                numberBufferBytes[0] = decodeBytes[index];
                numberBufferBytes[1] = decodeBytes[index + 1];
                numberBufferBytes[2] = decodeBytes[index + 2];
                numberBufferBytes[3] = 0;
                
                var value = numberBufferView.getUint32(0, true);
                index += 3;

                return value;
            },

            u32: function() {
                var value = decodeView.getUint32(index, true);
                index += 4;

                return value;
            },

            s8: function() {
                var value = decodeView.getInt8(index, true);
                index += 1;

                return value;
            },

            s16: function() {
                var value = decodeView.getInt16(index, true);
                index += 2;

                return value;
            },

            s24: function() {
                var u24 = numberHelper.read.u24();

                // Two's complement
                if (u24 >= MAX_VALUES.s24) return u24 - MAX_VALUES.u24;
                return u24;
            },

            s32: function() {
                var value = decodeView.getInt32(index, true);
                index += 4;

                return value;
            },

            f32: function() {
                var value = decodeView.getFloat32(index, true);
                index += 4;

                return value;
            },

            f64: function() {
                var value = decodeView.getFloat64(index, true);
                index += 8;

                return value;
            }
        }
    };
    
    // Handle exporting
    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = Binarify;
    } else {
        (typeof window !== "undefined") ? window.Binarify = Binarify : this.Binarify = Binarify;
    }
})();