# Binarify Documentation
In Binarify, Converter objects, which define a certain use-specific datatype or structure, have to be created first before any encoding/decoding can be performed.

All converters have the following method:
### Converter.set(...args: any)
Taking the exact same arguments as the Converter's constructor, this method allows for the Converter to be configured after it's been instanciated. This can be used to dynamically change the protocol or to create circular/recursive data structures (more info further down).

Additionally, Converters have `.encode` and `.decode` methods, but these are for internal used and should not be called from outside.

# Encoding / Decoding
After having instanciated a Converter, any data compatible with it can be encoded using:
### Binarify.encode(converter: Converter, data: any): ArrayBuffer | Buffer
It returns an ArrayBuffer (or a Buffer on Node) containing the encoded bytes, which can then be sent over the network or written to a file.

Decoding the bytes involves passing them to the `Binarify.decode` method, along with the Converter that was originally used to encode the bytes:
### Binarify.decode(converter: Converter, buffer: ArrayBuffer | Buffer): any
In general, the following holds:
```javascript
data == Binarify.decode(converter, Binarify.encode(converter, data))
// The == doesn't refer to JavaScript's equality operator, but rather means "equivalent to", concerning structure and value.
```

# Converter types

There are different types of Converters, each built for their respective datatype/structure:

[Binarify.Boolean](#binarifyboolean)<br>
[Binarify.Number](#binarifynumber)<br>
[Binarify.String](#binarifystring)<br>
[Binarify.HexString](#binarifyhexstring)<br>
[Binarify.Object](#binarifyobject)<br>
[Binarify.Array](#binarifyarray)<br>
[Binarify.Tuple](#binarifytuple)<br>
[Binarify.Dynamic](#binarifydynamic)<br>
[Binarify.SetElement](#binarifysetelement)<br>
[Binarify.BitField](#binarifybitfield)<br>
[Binarify.NullWrapper](#binarifynullwrapper)<br>

---
## Binarify.Boolean
Used for true/false values.<br>
### Instanciation syntax:
```javascript
new Binarify.Boolean()
```
### Encoding syntax:
```javascript
Binarify.encode(converter, boolean)
```
### Example:
```javascript
var bool = new Binarify.Boolean();
var encodedBool = Binarify.encode(bool, 4 < 7);
```

---
## Binarify.Number
Used for numbers of the specified type.<br>
### Instanciation syntax:
```javascript
new Binarify.Number([type])
```
*Arguments:*<br>
- `type` - *Optional.* The type which the number will be encoded in. Accepted values are **"u8"**, **"u16"**, **"u24"**, **"u32"**, **"s8"**, **"s16"**, **"s24"**, **"s32"**, **"f32"** and **"f64"**. Binarify uses [little-endian](https://en.wikipedia.org/wiki/Endianness) byte representations of numbers. Defaults to **"f64"** if not set.
### Encoding syntax:
```javascript
Binarify.encode(converter, number)
```
### Example:
```javascript
var appleCount = new Binarify.Number("u16");
var applesHarvested = Binarify.encode(appleCount, 7415);

var monthlyPay = new Binarify.Number("f32");
var payInJune = Binarify.encode(monthlyPay, 5012.83);
```

---
## Binarify.String
Used for strings stored in the UTF-8 format.
### Instanciation syntax:
```javascript
new Binarify.String([length])
```
*Arguments:*<br>
- `length` - *Optional.* Specifies the bytetype storing the length of the string. Accepted values are **"u8"**, **"u16"**, **"u24"**, **"u32"**, **"s8"**, **"s16"**, **"s24"**, **"s32"**, **"f32"**, **"f64"** and **"nullTerminated"** (null-terminated strings have no length limit), **or** an integer (used to define a string with *fixed length*, resulting in saved bytes). Inputs longer than the possible storable length will be shortened. Defaults to **nullTerminated** if not set.
### Encoding syntax:
```javascript
Binarify.encode(converter, string);
```
### Example:
```javascript
var message = new Binarify.String("u16"); // max length: 2^16 - 1
var encodedMessage = Binarify.encode(message, "The quick brown fox jumps over the lazy dog.");

var dateStr = new Binarify.String(10); // fixed length
var encodedDate = Binarify.encode(dateStr, "24-02-1955");
```

---
## Binarify.HexString
Used for hexadecimal strings. Stores them in about half the bytesize of what a regular string would require.
### Instanciation syntax:
```javascript
new Binarify.HexString([length])
```
*Arguments:*<br>
- `length` - *Optional.* Can be used to specify an exact length for the hex string (saves a few bytes).
### Encoding syntax:
```javascript
Binarify.encode(converter, hexString)
```
### Example:
```javascript
var sha1 = new Binarify.HexString(40); // fixed length of 40
var encodedHash = Binarify.encode(sha1, "74738ff55367e9589aee98fffdcd187694028007");
``` 

---
## Binarify.Object
Used for objects matching the predefined structure.
### Instanciation syntax:
```javascript
new Binarify.Object(blueprint[, loose])
```
*Arguments:*<br>
- `blueprint` - An object of key-value pairs where every value points to a *Converter* object.
- `loose` - *Optional.* Keys can be omitted if this is set to true. Otherwise, every key defined in the blueprint must also be present in the object passed to the `.encode()` method.
### Encoding syntax:
```javascript
Binarify.encode(converter, object)
// The structure of the passed object must match that specified within the blueprint.
```
### Example:
```javascript
var personBlueprint = new Binarify.Object({
    age: new Binarify.Number("u8"),
    name: new Binarify.String(),
    isMale: new Binarify.Boolean()
});
var person = {
    age: 42,
    name: "John Doe",
    isMale: false
};
var encodedPerson = Binarify.encode(personBlueprint, person);

// Circular structure using .set
var parentBlueprint = new Binarify.Object();
parentBlueprint.set({
    children: new Binarify.Array(parentBlueprint, 'u8')
});
var parent = {
    children: [{
        children: []
    }, {
        children: [{
            children: []
        }]
    }]
};
var encodedParent = Binarify.encode(parentBlueprint, parent);
```

---
## Binarify.Array
Used for arrays.
### Instanciation syntax:
```javascript
new Binarify.Array(element, maxSize)
```
*Arguments:*<br>
- `element` - A Converter object, specifying the structure of a single array element.
- `maxSize` - Specifies the bytetype storing the amount of pattern repitions. Accepted values are **"u8"**, **"u16"**, **"u24"**, **"u32"**, **"s8"**, **"s16"**, **"s24"**, **"s32"**, **"f32"**, **"f64"**, _or_ an integer (used to define a *fixed amount* of elements, resulting in saved bytes).
### Encoding syntax:
```javascript
Binarify.encode(converter, array)
```
### Example:
```javascript
var randomIntegersPattern = new Binarify.Array(new Binarify.Number("s32"), "u32");
var randomIntegers = [4, 75, 34, -725, 142, 92];
var encodedData = Binarify.encode(randomIntegersPattern, randomIntegers);
```

---
## Binarify.Tuple
Used for [tuples](https://en.wikipedia.org/wiki/Tuple).
### Instanciation syntax:
```javascript
new Binarify.Tuple(elements)
```
*Arguments:*<br>
- `elements` - An array of Converter objects, specifying the structure of the tuple.
### Encoding syntax:
```javascript
Binarify.encode(converter, tuple) // 'tuple' is an array
```
### Example:
```javascript
var vector3 = new Binarify.Tuple([new Binarify.Number("f32"), new Binarify.Number("f32"), new Binarify.Number("f32")]);
var position = [2.5, -5, 0];
var encodedVector = Binarify.encode(vector3, position);
```

---
## Binarify.Dynamic
Used for cases in which the programmer can't predetermine or predict the required datatype/structure or where varying types are expected. All possible datatypes have to be predefined and named.
### Instanciation syntax:
```javascript
new Binarify.Dynamic(pairs)
```
*Arguments:*<br>
- `pairs` - An associative object, where every key points to a Converter object which will define the datatype for that specific key.
### Encoding syntax:
```javascript
Binarify.encode(converter, {key: desiredKey, value: dataToEncode});
/* desiredKey has to be a key of the specified pairs object, and the structure of
   that key's value has to match that of dataToEncode. */
```
### Example:
```javascript
var chairBlueprint = new Binarify.Object({height: new Binarify.Number("f32")}),
    tableBlueprint = new Binarify.Object({area: new Binarify.Number("f32")}),
    lampBlueprint = new Binarify.Object({color: new Binarify.String()});
    
var furnitureArray = new Binarify.Array(new Binarify.Dynamic({
    chair: chairBlueprint,
    table: tableBlueprint,
    lamp: lampBlueprint
}), "u8");

var encodedData = furnitureArray.encode([
    {key: "chair", value: {height: 0.73}},
    {key: "chair", value: {height: 0.25}},
    {key: "lamp", value: {color: "orange"}},
    {key: "table", value: {area: 2.125}},
    {key: "lamp", value: {color: "white"}}
]);
```
Instead of assigning a key to a Converter, one can also assign it to `null`. This is useful for when the key itself carries meaning and doesn't actually need to hold any additional data.
```javascript
var message = new Binarify.Dynamic({
    sayHi: null,
    sayNumber: new Binarify.Number()
});

function handleMessage(msg) {
    if (msg.key === "sayHi") console.log("Hi");
    if (msg.key === "sayNumber") console.log(msg.value);
}

var encoded = Binarify.encode(message, {key: "sayHi" /* 'value' does not need to be specified in this case */});
var decoded = Binarify.decode(message, encoded);

handleMessage(decoded);
```

---
## Binarify.SetElement
Used to encode a reference to an element of a predefined set. Good if you know the value can only be a few things.
### Instanciation syntax:
```javascript
new Binarify.SetElement(set[, noSerialization])
```
*Arguments:*<br>
- `set` - An array specifying all the possible elements. The element has to be serializable if `noSerialization` isn't `true`.
- `noSerialization` - *Optional.* If set to `true`, elements in the `set` array won't be serialized. This means you can encode almost everything, but will result in the direct reference to the variable being returned by `decode()` - meaning it can be changed locally and will thus differ from all parties involved. Only use if you know what you're doing, or if you want to pass functions or read-only objects. Defaults to `false`.
### Encoding syntax:
```javascript
Binarify.encode(converter, element) // 'element' must be contained in the set
```
### Example:
```javascript
var elem = new Binarify.SetElement(["a", "b", "c", true, Math.PI, {foo: "bar"}, [0, 1, 2]]);

// These all work
Binarify.encode(elem, "a"));
Binarify.encode(elem, "b"));
Binarify.encode(elem, "c"));
Binarify.encode(elem, true));
Binarify.encode(elem, Math.PI));
Binarify.encode(elem, {foo: "bar"}));
Binarify.encode(elem, [0, 1, 2]));

// These don't work
Binarify.encode(elem, Math.E));
Binarify.encode(elem, {name: "John Doe"}));

/* Example for no serialization: */
var referenceElem = new Binarify.SetElement([Math, setInterval], true);

let encoded = Binarify.encode(referenceElem, Math);
let decoded = Binarify.decode(referenceElem, Math);

decoded.sqrt(25); // => 5
```

---
## Binarify.BitField
Used to encode a boolean [bit field](https://en.wikipedia.org/wiki/Bit_field). This is great if you need to encode many booleans in a group.
###
```javascript
new Binarify.BitField(attributes)
```
*Arguments:*<br>
- `attributes` - An array specifying all attributes of the bit field.
### Encoding syntax:
```javascript
Binarify.encode(converter, field) // `field` is an object where each key is an attribute and has a value of true/false.
```
### Example:
```javascript
var drinkProperties = new Binarify.BitField(["isCold", "isAlcoholic", "isSparkling", "isSweet"]);

var encodedCoke = Binarify.encode(drinkProperties, {
    isCold: true,
    isAlcoholic: false,
    isSparkling: true,
    isSweet: true
}); // This bitfield will be '1011'
```

---
## Binarify.NullWrapper
Used for cases where `null` might be passed to the converter, instead of the specified data structure.
### Instanciation syntax:
```javascript
new Binarify.NullWrapper(converterObject)
```
*Arguments:*<br>
- `converterObject` - Any Converter object. Will be used to encode the data if it isn't `null`. **This argument can technically be omitted**, but then the Converter will simply convert everything to `null`, and only to `null`.
### Encoding syntax:
```javascript
Binarify.encode(converter, data);
```
### Example:
```javascript
/* Simple example */
var number = new Binarify.Number();
var wrapped = new Binarify.NullWrapper(number);

// Both work:
Binarify.encode(wrapped, 1337);
Binarify.encode(wrapped, null);

/* Complex example */
var clientDataBlueprint = new Binarify.Object({
    firstName: new Binarify.String(),
    lastName: new Binarify.String(),
    email: new Binarify.String(),
    dateOfBirth: new Binarify.NullWrapper(new Binarify.Number("u32")), // This...
    phoneNumber: new Binarify.NullWrapper(new Binarify.String()) // ...and this field might be 'null'
});

var encodedData = Binarify.encode(clientDataBlueprint, {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    dateOfBirth: null,
    phoneNumber: "123 456 789"
});
```