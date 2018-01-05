/*
    BinaryJS v1.0.3
    @Vanilagy
*/

(function() {
    var BYTE_MAX_VALUE = 256;
    var SHORT_MAX_VALUE = 65536;
    var TRIBYTE_MAX_VALUE = 16777216; // Almost never used, but turns out to be a good sweetspot for some uses
    var INT_MAX_VALUE = 4294967296;
    
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
    
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Converts the character's char codes to raw binary representation (used for floating-points)
    function strToBin(str) {
        var bin = "";

        for (var i = 0; i < str.length; i++) {
            bin += ("00000000" + str.charCodeAt(i).toString(2)).slice(-8);
        }

        return bin;
    }
    
    /*
        Main object, containing all different data and structure types, each with their encoding and decoding methods.
        
        A data or structure object, when instanciated, will turn whatever input is piped into its encode method into
        a very compact binary representation. This only works if the structure and properties of the input match those
        that the method expects. Plugging the output of the encode method into the decode method will recreate the original
        input.
        
        Within the decode method, the passed binary string is stored inside an object to ensure it can be passed by reference, 
        not my value. This is necessary for nested and/or recursive decoding processes.
    */
    
    var Binary = {
        Boolean: function() {            
            this.encode = function(boolean) {
                return formatter.toUByte(boolean ? 1 : 0);
            };
            
            this.decode = function(binStr) {
                var binStrRef = typeof binStr === "string" ? {val: binStr} : binStr;
                
                var output = formatter.fromUByte(binStrRef.val.charAt(0)) === 1;
                binStrRef.val = binStrRef.val.slice(1);
                
                return output;
            };
        },
        
        Number: function(type) {
            // Defaults to JavaScript's "double"
            type = type || "double";
            var size = getLengthByType(((type !== "double" && type !== "float") ? type.slice(1) : type).toLowerCase());

            this.encode = function(number) {
                return formatter["to" + capitalizeFirstLetter(type)](number);
            };
            
            this.decode = function(binStr) {
                var binStrRef = typeof binStr === "string" ? {val: binStr} : binStr;
                
                var output = formatter["from" + capitalizeFirstLetter(type)](binStrRef.val.slice(0, size));
                binStrRef.val = binStrRef.val.slice(size);
                
                return output;
            };
        },
        
        String: function(maxSize) {
            // Defaults to a null-terminated string
            maxSize = maxSize || "nullTer";
            
            this.encode = function(string) {
                if (maxSize === "nullTer") {
                    // Append null-terminator to the end
                    return string + String.fromCharCode(0);
                } else {
                    // Prepend the string's length
                    return formatter["toU" + capitalizeFirstLetter(maxSize)](string.length) + string.slice(0, getLengthByType(maxSize));
                }
            };
            
            this.decode = function(binStr) {
                var binStrRef = typeof binStr === "string" ? {val: binStr} : binStr;
                
                var output;
                if (maxSize === "nullTer") {
                    output = binStrRef.val.slice(0, binStrRef.val.indexOf(String.fromCharCode(0)));
                    binStrRef.val = binStrRef.val.slice(output.length + 1);
                } else {
                    var typeSize = getLengthByType(maxSize);
                    var length = formatter["fromU" + capitalizeFirstLetter(maxSize)](binStrRef.val.slice(0, typeSize));
                    output = binStrRef.val.slice(typeSize, typeSize + length);
                    binStrRef.val = binStrRef.val.slice(typeSize + length);
                }
                return output;
            };
        },
        
        Object: function(blueprint) {            
            this.encode = function(obj) {
                var binStr = "";
                
                for (var key in blueprint) {
                    binStr += blueprint[key].encode(obj[key]);
                }
                
                return binStr;
            };
            
            this.decode = function(binStr) {
                var obj = {};
                var binStrRef = typeof binStr === "string" ? {val: binStr} : binStr;
                
                for (var key in blueprint) {
                    obj[key] = blueprint[key].decode(binStrRef);
                }
                
                return obj;
            };
        },
        
        Array: function(pattern, repeatSize) {
            /*
                If repeatSize is not given, the array will be looked at as more of an "unnamed object", simply specifying
                a pattern of set datatypes and length.
            */
            if (repeatSize) var repeatSizeLength = getLengthByType(repeatSize);
            
            this.encode = function(arr) {
                var binStr = "";
                
                if (repeatSize) {
                    var repeats = Math.ceil(arr.length / pattern.length);
                
                    for (var i = 0; i < repeats; i++) {
                        for (var j = 0; j < pattern.length; j++) {
                            binStr += pattern[j].encode(arr[i * pattern.length + j]);
                        }
                    }
                    
                    binStr = formatter["toU" + capitalizeFirstLetter(repeatSize)](repeats) + binStr;
                } else {
                    for (var i = 0; i < pattern.length; i++) {
                        binStr += pattern[i].encode(arr[i]);
                    }
                }
                
                return binStr;
            };
            
            this.decode = function(binStr) {
                var arr = [];
                var binStrRef = typeof binStr === "string" ? {val: binStr} : binStr;
                
                if (repeatSize) {
                    var repeats = formatter["fromU" + capitalizeFirstLetter(repeatSize)](binStrRef.val.slice(0, repeatSizeLength));
                    binStrRef.val = binStrRef.val.slice(repeatSizeLength);
                    
                    for (var i = 0; i < repeats; i++) {
                        for (var j = 0; j < pattern.length; j++) {
                            arr[i * pattern.length + j] = pattern[j].decode(binStrRef);
                        }
                    }
                } else {
                    for (var i = 0; i < pattern.length; i++) {
                        arr[i] = pattern[i].decode(binStrRef);
                    }
                }
                
                return arr;
            };
        },
                
        Dynamic: function(pairs) {
            var keys = Object.keys(pairs);
            var keyLengthByteLength = Math.ceil(Math.log2(keys.length) / 8) || 1;            
            var keyLengthByteType = getTypeByLength(keyLengthByteLength);
            keyLengthByteLength = getLengthByType(keyLengthByteType); // Set to 8 if type is double
            
            this.encode = function(pairObj) {
                return formatter["to" + ((keyLengthByteType !== "double") ? "U" : "") + capitalizeFirstLetter(keyLengthByteType)](keys.indexOf(pairObj.key)) + pairs[pairObj.key].encode(pairObj.value);
            };
            
            this.decode = function(binStr) {
                var binStrRef = typeof binStr === "string" ? {val: binStr} : binStr;
                
                var key = keys[formatter["from" + ((keyLengthByteType !== "double") ? "U" : "") + capitalizeFirstLetter(keyLengthByteType)](binStrRef.val.slice(0, keyLengthByteLength))];
                binStrRef.val = binStrRef.val.slice(keyLengthByteLength);
                
                return {key: key, value: pairs[key].decode(binStrRef)};
            };
        }
    };
    
    // Helper object, used to convert from and to different number types
    var formatter = {
        fromUByte: function(string) {
            return string.charCodeAt(0);
        },
        
        toUByte: function(number) {
            number = Math.round(number);
            
            return String.fromCharCode(number);
        },
        
        fromUShort: function(string) {
            return string.charCodeAt(0) * BYTE_MAX_VALUE + string.charCodeAt(1);
        },
        
        toUShort: function(number) {
            number = Math.round(number);
            
            return String.fromCharCode(Math.floor(number / BYTE_MAX_VALUE)) + String.fromCharCode(number % BYTE_MAX_VALUE);
        },
        
        fromUTribyte: function(string) {
            return string.charCodeAt(0) * SHORT_MAX_VALUE + string.charCodeAt(1) * BYTE_MAX_VALUE + string.charCodeAt(2);
        },
        
        toUTribyte: function(number) {
            number = Math.round(number);
            
            return String.fromCharCode(Math.floor(number / (SHORT_MAX_VALUE))) + String.fromCharCode(Math.floor((number % (SHORT_MAX_VALUE)) / BYTE_MAX_VALUE)) + String.fromCharCode(number % BYTE_MAX_VALUE);
        },
        
        fromUInt: function(string) {
            return string.charCodeAt(0) * TRIBYTE_MAX_VALUE + string.charCodeAt(1) * SHORT_MAX_VALUE + string.charCodeAt(2) * BYTE_MAX_VALUE + string.charCodeAt(3);
        },
        
        toUInt: function(number) {
            number = Math.round(number);
            
            return String.fromCharCode(Math.floor(number / (TRIBYTE_MAX_VALUE))) + String.fromCharCode(Math.floor((number % (TRIBYTE_MAX_VALUE)) / (SHORT_MAX_VALUE))) + String.fromCharCode(Math.floor(number % (SHORT_MAX_VALUE) / BYTE_MAX_VALUE)) + String.fromCharCode(number % BYTE_MAX_VALUE);
        },
        
        /*
            Signed datatypes simply shift values upon encoding and revert the shift when decoding. Might use 2's
            complement in the future, though.
        */
        
        fromSByte: function(string) {
            return this.fromUByte(string) - BYTE_MAX_VALUE / 2;
        },
        
        toSByte: function(number) {
            return this.toUByte(number + BYTE_MAX_VALUE / 2);
        },
        
        fromSShort: function(string) {
            return this.fromUShort(string) - SHORT_MAX_VALUE / 2;
        },
        
        toSShort: function(number) {
            return this.toUShort(number + SHORT_MAX_VALUE / 2);
        },
        
        fromSTribyte: function(string) {
            return this.fromUTribyte(string) - TRIBYTE_MAX_VALUE / 2;
        },
        
        toSTribyte: function(number) {
            return this.toUTribyte(number + TRIBYTE_MAX_VALUE / 2);
        },
        
        fromSInt: function(string) {
            return this.fromUInt(string) - INT_MAX_VALUE / 2;
        },
        
        toSInt: function(number) {
            return this.toUInt(number + INT_MAX_VALUE / 2);
        },
        
        // Uses float format as described in the IEEE 754 standard (almost).
        
        fromFloat: function(string) {
            // String has to be expanded out into its pure binary representation
            var bin = strToBin(string);
            
            // Significand starts at one, decimal places are added further down
            var frac = 1;
            
            // Get true exponent by offsetting by the exponent bias
            var exp = parseInt(bin.substr(1, 8), 2) - 127;
            
            var sign = ((bin.charAt(0) === "0") ? 1 : -1);

            if (exp === -127) { // Special case for 0
                return 0 * sign;
            } else if (exp === 128) { // Special case for NaN or Infinity
                if (bin.charAt(9) === "0") { // Check if significand is zero
                    return Infinity * sign;
                } else {
                    return NaN;
                }
            }

            // Add to the significand
            for (var i = 1; i <= 23; i++) {
                if (bin.charAt(8 + i) === "1") {
                    frac += Math.pow(2, -i);
                }
            }

            return Math.pow(2, exp) * frac * sign;
        },
        
        toFloat: function(number) {
            // The string that will store the raw binary representation of the floating-point number
            var bits;
            
            if (number === 0) { // Triggers special encoding for 0
                bits = ((1 / number > 0) ? "0" : "1") + "0000000000000000000000000000000";
            } else if (isNaN(number)) {
                bits = "01111111110000000000000000000000"; // Exp 255, significand non-zero
            } else {
                var abs = Math.abs(number);
                var exp = Math.min(128, Math.max(-127, Math.floor(Math.log2(abs))));
                var frac = abs / Math.pow(2, exp);
                
                if (exp === 128) { // Infinity
                    bits = ((number < 0) ? "1" : "0") + "1111111100000000000000000000000";
                } else {
                    bits = ((number < 0) ? "1" : "0") + ("00000000" + (exp + 127).toString(2)).slice(-8) + (frac.toString(2) + "00000000000000000000000").substr(2, 23);
                }
            }

            // Convert bits to UTF-8
            var output = "";
            for (var i = 0; i < 4; i++) {
                output += String.fromCharCode(parseInt(bits.slice(i * 8, i * 8 + 8), 2));
            }
            return output;
        },
        
        // Doubles function identically to floats, but make use of the additional 32 bits they take up.
        fromDouble: function(string) {
            var bin = strToBin(string);
            var frac = 1;
            var exp = parseInt(bin.substr(1, 11), 2) - 1023;
            var sign = ((bin.charAt(0) === "0") ? 1 : -1);

            if (exp === -1023) {
                return 0 * sign;
            } else if (exp === 1024) {
                if (bin.charAt(12) === "0") {
                    return Infinity * sign;
                } else {
                    return NaN;
                }
            }

            for (var i = 1; i <= 52; i++) {
                if (bin.charAt(11 + i) === "1") {
                    frac += Math.pow(2, -i);
                }
            }

            return Math.pow(2, exp) * frac * sign;
        },
        
        toDouble: function(number) {
            var bits;
            
            if (number === 0) {
                bits = ((1 / number > 0) ? "0" : "1") + "000000000000000000000000000000000000000000000000000000000000000";
            } else if (isNaN(number)) {
                bits = "0111111111111000000000000000000000000000000000000000000000000000";
            } else {
                var abs = Math.abs(number);
                var exp = Math.min(1024, Math.max(-1023, Math.floor(Math.log2(abs))));
                var frac = abs / Math.pow(2, exp);
                
                if (exp === 1024) {
                    bits = ((number < 0) ? "1" : "0") + "111111111110000000000000000000000000000000000000000000000000000";
                } else {
                    bits = ((number < 0) ? "1" : "0") + ("00000000000" + (exp + 1023).toString(2)).slice(-11) + (frac.toString(2) + "0000000000000000000000000000000000000000000000000000").substr(2, 52);
                }
            }

            var output = "";
            for (var i = 0; i < 8; i++) {
                output += String.fromCharCode(parseInt(bits.slice(i * 8, i * 8 + 8), 2));
            }
            return output;
        }
    };
    
    // Handle exporting of the framework
    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = Binary;
    } else {
        (typeof window !== "undefined") ? window.Binary = Binary : this.Binary = Binary;
    }
})();