/*
    Binarify v2.4.1
    @Vanilagy
*/

(function() {
    var MAX_VALUES = {
        byte: 256,
        short: 65536,
        tribyte: 16777216, // Rarely used, but turns out to be a good sweetspot for some cases
        int: 4294967296,
        float: 16777217,
        double: Number.MAX_SAFE_INTEGER
    };
    var ELEMENTAL_NUMBER_TYPES = ["byte", "short", "tribyte", "int", "float", "double"];
    var EXTENDED_NUMBER_TYPES = ["uByte", "sByte", "uShort", "sShort", "uTribyte", "sTribyte", "uInt", "sInt", "float", "double"];
    
    function getLengthByType(type) {
        switch (type) {
            case "byte": return 1; break;
            case "short": return 2; break;
            case "tribyte": return 3; break;
            case "int": return 4; break;
            case "float": return 4; break;
            case "double": return 8; break;
            default: throw new Error("Incorrect number type '" + type + "'");
        }
    }
    
    function getTypeByLength(length) {
        switch (length) {
            case 1: return "byte"; break;
            case 2: return "short"; break;
            case 3: return "tribyte"; break;
            case 4: return "int"; break;
            default: return "double"; // Double can store the highest integer out of all available datatypes
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
    
    // Current starting index used by the decoder; is set to zero any decode() method is called from the outside.
    var index = 0;
    
    /*
        Main object, containing all different data and structure types, each with their encoding and decoding methods.
        
        A data or structure object, when instanciated, will turn whatever input is piped into its encode method into
        a very compact binary representation. This only works if the structure and properties of the input match those
        that the method expects. Plugging the output of the encode method into the decode method will recreate the original
        input.
    */
    var Binarify = {
        version: "2.4.1", // Can be used to compare client and server
        
        Boolean: function() {
            this.set = function() {return this};
            
            this.encode = function(boolean) {
                return boolean ? "\u0001" : "\u0000";
            };
            
            this.decode = function(binStr, isInternalCall) {
                if (isInternalCall !== true) index = 0;
                
                return binStr.charCodeAt(index++) === 1;
            };
        },
        
        Number: function(type) {
            var size;
            
            this.set = function(typeNew) {
                // Defaults to JavaScript's default "double"
                type = typeNew || "double";
                if (EXTENDED_NUMBER_TYPES.indexOf(type) === -1) throw new Error("Incorrect Number type '" + type + "'");
                size = getLengthByType(((type !== "double" && type !== "float") ? type.slice(1) : type).toLowerCase());
                
                return this;
            };
            this.set(type);

            this.encode = function(number) {
                return formatter.to[type](number);
            };
            
            this.decode = function(binStr, isInternalCall) {
                if (isInternalCall !== true) index = 0;
                
                var output = formatter.from[type](binStr.substr(index, size));
                index += size;
                
                return output;
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
                    size = maxSize || "nullTer";
                    if (size !== "nullTer" && ELEMENTAL_NUMBER_TYPES.indexOf(size) === -1) throw new Error("Incorrect String size number type '" + size + "'");
                } else {
                    maxSize = Math.floor(maxSize);
                    if (maxSize < 0) throw new Error("String cannot have a fixed length shorter than 0");
                    length = maxSize;
                }
                
                return this;
            };
            this.set(maxSize);
            
            this.encode = function(string) {
                if (!hasExactLength) {
                    if (size === "nullTer") {
                        if (string.indexOf("\u0000") !== -1) string.replace(/\u0000/g, " "); // All NULL-characters will be replaced with a space
                        // Append null-terminator to the end
                        return string + "\u0000";
                    } else {
                        // Prepend the string's length
                        string = string.slice(0, MAX_VALUES[size]-1);
                        return formatter.to[size](string.length) + string;
                    }
                } else {
                    if (string.length === length) {
                        return string;
                    } else {
                        throw new Error("Passed string isn't of specified length " + length);
                    }
                }
            };
            
            this.decode = function(binStr, isInternalCall) {
                if (isInternalCall !== true) index = 0;
                
                var output;

                if (!hasExactLength) {
                    if (size === "nullTer") {
                        output = binStr.slice(index, binStr.indexOf("\u0000", index));
                        index += output.length + 1;
                    } else {
                        var typeSize = getLengthByType(size);
                        var len = formatter.from[size](binStr.substr(index, typeSize));
                        output = binStr.substr(index + typeSize, len);
                        index += typeSize + len;
                    }
                } else {
                    output = binStr.substr(index, length);
                    index += length;
                }
                
                return output;
            };
        },
        
        HexString: function(length) {
            var hasExactLength;
            
            this.set = function(lengthNew) {
                length = lengthNew;
                
                hasExactLength = typeof length === "number";
                
                if (hasExactLength) {
                    length = Math.floor(length);
                    if (length < 0) throw new Error("HexString cannot have a fixed length shorter than 0");
                }
                
                return this;
            };
            this.set(length);

            this.encode = function(string) {
                if (!isHexString(string)) throw new Error("Passed string is not a HexString!");
                if (hasExactLength && string.length !== length) throw new Error("Passed string isn't of specified length " + length);

                var binStr = "";

                // Makes sure the decoder knows if the last byte is used fully or only half of it
                if (!hasExactLength) binStr += String.fromCharCode((string.length % 2 === 0) ? 1 : 0);

                for (var i = 0; i < string.length; i += 2) {
                    binStr += String.fromCharCode(parseInt(string.substr(i, (string.length - i >= 2) ? 2 : 1), 16));
                }

                if (!hasExactLength) binStr += "\u0100"; // (256) Cheating a little here

                return binStr;
            };

            this.decode = function(binStr, isInternalCall) {
                if (isInternalCall !== true) index = 0;

                var data;
                if (!hasExactLength) {
                    var lastByteFull = (binStr.charCodeAt(index) === 1) ? true : false;
                    var endIndex = binStr.indexOf("\u0100", index);
                    data = binStr.slice(index+1, endIndex);
                } else {
                    data = binStr.substr(index, Math.ceil(length / 2));
                }

                var hexString = "";
                for (var i = 0; i < data.length; i++) {
                    if (i !== data.length - 1) {
                        hexString += ("00" + data.charCodeAt(i).toString(16)).slice(-2);
                    } else {
                        var lastByteDifferent = false;
                        if (!hasExactLength && !lastByteFull) lastByteDifferent = true;
                        if (hasExactLength && length % 2 === 1) lastByteDifferent = true;

                        if (!lastByteDifferent) {
                            hexString += ("00" + data.charCodeAt(i).toString(16)).slice(-2);
                        } else {
                            hexString += data.charCodeAt(i).toString(16);
                        }
                    }
                }

                index += data.length + ((hasExactLength) ? 0 : 2);
                return hexString;
            };
        },
        
        Object: function(blueprint, loose /* If loose is set, keys in the input can be omitted */) {
            var keys, keyLengthByteLength, keyLengthByteType;
            
            this.set = function(blueprintNew, looseNew) {
                blueprint = blueprintNew;
                loose = looseNew;
                
                if (blueprint === undefined) return;

                keys = Object.keys(blueprint);
                keys.sort(); // This is done to guarantee key order across all JavaScript implementations

                if (loose) {
                    keyLengthByteLength = Math.ceil(Math.log2(keys.length) / 8) || 1;            
                    keyLengthByteType = getTypeByLength(keyLengthByteLength);
                    keyLengthByteLength = getLengthByType(keyLengthByteType); // Set to 8 if type is double
                }
                
                return this;
            };
            this.set(blueprint, loose);
            
            this.encode = function(obj) {
                if (blueprint === undefined) throw new Error("Can't encode, no blueprint defined");
                
                var binStr = "";
                
                if (!loose) {
                    for (var i = 0; i < keys.length; i++) {
                        var key = keys[i];
                        if (obj[key] === undefined) throw new Error("Key '" + key + "' is defined in the blueprint, but not in the input object");
                        binStr += blueprint[key].encode(obj[key]);
                    }
                } else {
                    var attributeCount = 0;
                    
                    for (var key in obj) {
                        if (blueprint[key] !== undefined) {
                            binStr += formatter.to[keyLengthByteType](keys.indexOf(key)) + blueprint[key].encode(obj[key]);
                            attributeCount++;
                        }
                    }
                    
                    binStr = formatter.to[keyLengthByteType](attributeCount) + binStr;
                }
                
                return binStr;
            };
            
            this.decode = function(binStr, isInternalCall) {
                if (isInternalCall !== true) index = 0;
                
                var obj = {};
            
                if (!loose) {
                    for (var i = 0; i < keys.length; i++) {
                        var key = keys[i];
                        obj[key] = blueprint[key].decode(binStr, true);
                    }
                } else {
                    var numberOfKeys = formatter.from[keyLengthByteType](binStr.substr(index, keyLengthByteLength));
                    index += keyLengthByteLength;

                    for (var i = 0; i < numberOfKeys; i++) {
                        var key = keys[formatter.from[keyLengthByteType](binStr.substr(index, keyLengthByteLength))];
                        index += keyLengthByteLength;

                        obj[key] = blueprint[key].decode(binStr, true);
                    }
                }
                
                return obj;
            };
        },
        
        Array: function(pattern, repeatSize) {
            var hasExactLength, repeatSizeLength;
            
            this.set = function(patternNew, repeatSizeNew) {
                pattern = patternNew;
                repeatSize = repeatSizeNew;
                
                if (pattern === undefined) return;

                /*
                    If repeatSize is not given, the array will be looked at as more of an "unnamed object", simply specifying
                    a pattern of set datatypes and length.
                */
                if (repeatSize !== undefined) {
                    // Figure out if repeatSize is a number or a number size
                    hasExactLength = typeof repeatSize === "number";

                    if (!hasExactLength) {
                        if (ELEMENTAL_NUMBER_TYPES.indexOf(repeatSize) > -1) {
                            repeatSizeLength = getLengthByType(repeatSize);
                        } else {
                            throw new Error("Incorrect Array size number type '" + repeatSize + "'");
                        }
                    } else {
                        repeatSize = Math.floor(repeatSize);
                        if (repeatSize < 0) throw new Error("Array cannot have a fixed length shorter than 0");
                    }
                }
                
                return this;
            };
            this.set(pattern, repeatSize);
            
            this.encode = function(arr) {
                if (pattern === undefined) throw new Error("Can't encode, no pattern defined");
                
                if (pattern.length && arr.length % pattern.length !== 0) throw new Error("Array (length " + arr.length + ") contains at least one incomplete pattern");
                var binStr = "";
                
                if (repeatSize !== undefined) {
                    if (!hasExactLength) {
                        arr = arr.slice(0, (MAX_VALUES[repeatSize]-1) * pattern.length); // Trim the array so it fits into the specified repeatSize
                    } else {
                        if (arr.length !== repeatSize * pattern.length) throw new Error("Array pattern in the input isn't repeated exactly " + repeatSize + " times, as was specified");
                    }
                    
                    var repeats = Math.ceil(arr.length / pattern.length);
                    if (repeats !== repeats /* is NaN */) {
                        repeats = 0;
                    }
                
                    for (var i = 0; i < repeats; i++) {
                        for (var j = 0; j < pattern.length; j++) {
                            binStr += pattern[j].encode(arr[i * pattern.length + j]);
                        }
                    }
                    
                    if (!hasExactLength) binStr = formatter.to[repeatSize](repeats) + binStr; // Prepend pattern repetition count
                } else {
                    if (arr.length < pattern.length) throw new Error("Input array (length " + arr.length + ") has to be at least as long as the pattern array (length " + pattern.length + ")");
                    
                    for (var i = 0; i < pattern.length; i++) {
                        binStr += pattern[i].encode(arr[i]);
                    }
                }
                
                return binStr;
            };
            
            this.decode = function(binStr, isInternalCall) {
                if (isInternalCall !== true) index = 0;
                
                var arr = [];
                
                if (repeatSize !== undefined) {
                    var repeats;
                    if (!hasExactLength) {
                        repeats = formatter.from[repeatSize](binStr.substr(index, repeatSizeLength));
                        index += repeatSizeLength;
                    } else {
                        repeats = repeatSize;
                    }
                    
                    for (var i = 0; i < repeats; i++) {
                        for (var j = 0; j < pattern.length; j++) {
                            arr[i * pattern.length + j] = pattern[j].decode(binStr, true);
                        }
                    }
                } else {
                    for (var i = 0; i < pattern.length; i++) {
                        arr[i] = pattern[i].decode(binStr, true);
                    }
                }
                
                return arr;
            };
        },
                
        Dynamic: function(pairs) {
            var keys, keyLengthByteLength, keyLengthByteType;
            
            this.set = function(pairsNew) {
                pairs = pairsNew;
                
                if (pairs === undefined) return;
            
                keys = Object.keys(pairs);
                keys.sort(); // Same reasoning as in Binarify.Object
                keyLengthByteLength = Math.ceil(Math.log2(keys.length) / 8) || 1;            
                keyLengthByteType = getTypeByLength(keyLengthByteLength);
                keyLengthByteLength = getLengthByType(keyLengthByteType); // Set to 8 if type is double
                
                return this;
            };
            this.set(pairs);
            
            this.encode = function(arg1, arg2) {
                if (pairs === undefined) throw new Error("Can't encode, no pairs object defined");
                
                var key, value;
                if (arg2 !== undefined) {
                    key = arg1;
                    value = arg2;
                } else {
                    key = arg1.key;
                    value = arg1.value;
                }

                if (pairs[key] === undefined) throw new Error("Key '" + key + "' is not defined");
                return formatter.to[keyLengthByteType](keys.indexOf(key)) + ((pairs[key] === null) ? "" : pairs[key].encode(value));
            };
            
            this.decode = function(binStr, isInternalCall) {
                if (isInternalCall !== true) index = 0;
                
                var key = keys[formatter.from[keyLengthByteType](binStr.substr(index, keyLengthByteLength))];
                index += keyLengthByteLength;
                
                return {key: key, value: (pairs[key] === null) ? null : pairs[key].decode(binStr, true)};
            };
        },
        
        SetElement: function(elements, noSerialization) {
            var stringifiedElements, stringifiedElementsArr, keyLengthByteLength, keyLengthByteType;
            
            this.set = function(elementsNew, noSerializationNew) {
                elements = elementsNew;
                noSerialization = noSerializationNew;
                
                if (elements === undefined) return;

                if (!noSerialization) {
                    stringifiedElements = {}, stringifiedElementsArr = [];
                    for (var i = 0; i < elements.length; i++) {
                        try {
                            var json = JSON.stringify(elements[i]);
                            if (json === undefined) throw new Error("Element " + elements[i] + " serialized to 'undefined', thaz' bad.");

                            stringifiedElements[json] = i;
                            stringifiedElementsArr.push(json);
                        } catch(e) {
                            throw new Error("Set element " + elements[i] + " couldn't be serialized", e);
                        }
                    }
                }

                keyLengthByteLength = Math.ceil(Math.log2(elements.length) / 8) || 1;            
                keyLengthByteType = getTypeByLength(keyLengthByteLength);
                keyLengthByteLength = getLengthByType(keyLengthByteType); // Set to 8 if type is double
                
                return this;
            };
            this.set(elements, noSerialization);
            
            this.encode = function(element) {
                if (elements === undefined) throw new Error("Can't encode, no element array defined");
                
                var index;
                if (noSerialization) {
                    index = elements.indexOf(element);
                } else {
                    index = stringifiedElements[JSON.stringify(element)];
                }
                
                if (!(index === -1 || index === undefined)) {
                    return formatter.to[keyLengthByteType](index);
                } else {
                    throw new Error("Element " + element + " not specified in Set");
                }
            };
            
            this.decode = function(binStr, isInternalCall) {
                if (isInternalCall !== true) index = 0;
                
                var elementIndex = formatter.from[keyLengthByteType](binStr.substr(index, keyLengthByteLength));
                index += keyLengthByteLength;
                
                if (noSerialization) {
                    return elements[elementIndex];
                } else {
                    return JSON.parse(stringifiedElementsArr[elementIndex]);
                }
            };
        },
        
        BitField: function(attributes) {
            this.set = function(attributesNew) {
                attributes = attributesNew;
                
                return this;
            };
            
            this.encode = function(obj) {
                if (attributes === undefined) throw new Error("Can't encode, no attribute array defined");
                
                var output = "";
                
                var currentByte = 0;
                for (var i = 0; i < attributes.length; i++) {
                    if (i % 8 === 0 && i > 0) {
                        output += String.fromCharCode(currentByte);
                        currentByte = 0;
                    }
                    
                    var attribute = attributes[i];
                    if (obj[attribute] !== undefined) {
                        if (obj[attribute] === true) {
                            currentByte += Math.pow(2, i % 8);
                        }
                    } else {
                        throw new Error("Attribute '" + attribute + "' is defined in the BitField, but wasn't passed to it in its encode method");
                    }
                }
                if (attributes.length) {
                    output += String.fromCharCode(currentByte);
                }
                
                return output;
            };
            
            this.decode = function(binStr, isInternalCall) {
                if (isInternalCall !== true) index = 0;
                
                var obj = {};
                var currentIndex = 0,
                    currentCharCode = binStr.charCodeAt(index);
                
                for (var i = 0; i < attributes.length; i++) {
                    if (i % 8 === 0 && i > 0) {
                        currentIndex++;
                        currentCharCode = binStr.charCodeAt(index + currentIndex);
                    }
                    
                    obj[attributes[i]] = (currentCharCode & Math.pow(2, i % 8)) > 0;
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
            
            this.encode = function(data) {
                if (data === null || converter === undefined) {
                    return "\u0000";
                } else {
                    return "\u0001" + converter.encode(data);
                }
            };

            this.decode = function(binStr, isInternalCall) {
                if (isInternalCall !== true) index = 0;

                var isNull = binStr.charCodeAt(index++) === 0;

                if (isNull) {
                    return null;
                } else {
                    return converter.decode(binStr, true);
                }
            };
        }
    };
    
    // Buffer setup to allow for byte-reading of floating-point numbers following the IEEE 754 standard
    var floatBuffer = new ArrayBuffer(8);
    var floatByteView = new Uint8Array(floatBuffer),
        floatView = new Float32Array(floatBuffer),
        doubleView = new Float64Array(floatBuffer);
    
    // Helper object, used to convert from and to different number types
    var formatter = {
        to: {
            uByte: function(number) {
                number = adjustedMod(Math.round(number), MAX_VALUES.byte);

                return String.fromCharCode(number);
            },
            
            uShort: function(number) {
                number = adjustedMod(Math.round(number), MAX_VALUES.short);

                return String.fromCharCode(Math.floor(number / MAX_VALUES.byte)) + String.fromCharCode(number % MAX_VALUES.byte);
            },
            
            uTribyte: function(number) {
                number = adjustedMod(Math.round(number), MAX_VALUES.tribyte);

                return String.fromCharCode(Math.floor(number / (MAX_VALUES.short))) + String.fromCharCode(Math.floor((number % (MAX_VALUES.short)) / MAX_VALUES.byte)) + String.fromCharCode(number % MAX_VALUES.byte);
            },
            
            uInt: function(number) {
                number = adjustedMod(Math.round(number), MAX_VALUES.int);

                return String.fromCharCode(Math.floor(number / (MAX_VALUES.tribyte))) + String.fromCharCode(Math.floor((number % (MAX_VALUES.tribyte)) / (MAX_VALUES.short))) + String.fromCharCode(Math.floor(number % (MAX_VALUES.short) / MAX_VALUES.byte)) + String.fromCharCode(number % MAX_VALUES.byte);
            },
            
            sByte: function(number) {
                return this.uByte(number + MAX_VALUES.byte / 2);
            },
            
            sShort: function(number) {
                return this.uShort(number + MAX_VALUES.short / 2);
            },
            
            sTribyte: function(number) {
                return this.uTribyte(number + MAX_VALUES.tribyte / 2);
            },
            
            sInt: function(number) {
                return this.uInt(number + MAX_VALUES.int / 2);
            },
            
            float: function(number) { 
                floatView[0] = number;
                
                // No loops because performance fetish
                return String.fromCharCode(floatByteView[0]) + String.fromCharCode(floatByteView[1]) + String.fromCharCode(floatByteView[2]) + String.fromCharCode(floatByteView[3]);
            },
            
            double: function(number) {
                doubleView[0] = number;
                
                return String.fromCharCode(floatByteView[0]) + String.fromCharCode(floatByteView[1]) + String.fromCharCode(floatByteView[2]) + String.fromCharCode(floatByteView[3]) + String.fromCharCode(floatByteView[4]) + String.fromCharCode(floatByteView[5]) + String.fromCharCode(floatByteView[6]) + String.fromCharCode(floatByteView[7]);
            }
        },
        from: {
            uByte: function(string) {
                return adjustedMod(string.charCodeAt(0), MAX_VALUES.byte);
            },
            
            uShort: function(string) {
                return adjustedMod((string.charCodeAt(0) * MAX_VALUES.byte + string.charCodeAt(1)), MAX_VALUES.short);
            },
            
            uTribyte: function(string) {
                return adjustedMod((string.charCodeAt(0) * MAX_VALUES.short + string.charCodeAt(1) * MAX_VALUES.byte + string.charCodeAt(2)), MAX_VALUES.tribyte);
            },
            
            uInt: function(string) {
                return adjustedMod((string.charCodeAt(0) * MAX_VALUES.tribyte + string.charCodeAt(1) * MAX_VALUES.short + string.charCodeAt(2) * MAX_VALUES.byte + string.charCodeAt(3)), MAX_VALUES.int);
            },
            
            sByte: function(string) {
                return this.uByte(string) - MAX_VALUES.byte / 2;
            },
            
            sShort: function(string) {
                return this.uShort(string) - MAX_VALUES.short / 2;
            },
            
            sTribyte: function(string) {
                return this.uTribyte(string) - MAX_VALUES.tribyte / 2;
            },
            
            sInt: function(string) {
                return this.uInt(string) - MAX_VALUES.int / 2;
            },
            
            float: function(string) {
                floatByteView[0] = string.charCodeAt(0);
                floatByteView[1] = string.charCodeAt(1);
                floatByteView[2] = string.charCodeAt(2);
                floatByteView[3] = string.charCodeAt(3);
                
                return floatView[0];
            },
            
            double: function(string) {
                floatByteView[0] = string.charCodeAt(0);
                floatByteView[1] = string.charCodeAt(1);
                floatByteView[2] = string.charCodeAt(2);
                floatByteView[3] = string.charCodeAt(3);
                floatByteView[4] = string.charCodeAt(4);
                floatByteView[5] = string.charCodeAt(5);
                floatByteView[6] = string.charCodeAt(6);
                floatByteView[7] = string.charCodeAt(7);
                
                return doubleView[0];
            }
        }
    };
    // Alias
    formatter.to.byte = formatter.to.uByte;
    formatter.to.short = formatter.to.uShort;
    formatter.to.tribyte = formatter.to.uTribyte;
    formatter.to.int = formatter.to.uInt;
    formatter.from.byte = formatter.from.uByte;
    formatter.from.short = formatter.from.uShort;
    formatter.from.tribyte = formatter.from.uTribyte;
    formatter.from.int = formatter.from.uInt;
    
    // Handle exporting of the framework
    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = Binarify;
    } else {
        (typeof window !== "undefined") ? window.Binarify = Binarify : this.Binarify = Binarify;
    }
})();
