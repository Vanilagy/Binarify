# BinaryJS
BinaryJS is an ease-to-use JavaScript framework for encoding complex data structures into compact, bandwidth-saving binary data and back.

## Functionality
[Read full documentation](./ref/reference.md)

Prior to sending and receiving data, a data structure first has to be defined by the user, which will act as it's own unique binary protocol used to encode and decode the use-specific data. For this, BinaryJS has multiple different data and structure types, each sporting their own `.encode` and `.decode` methods.

**Example:**
```javascript
var signedInteger = new Binary.Number("sInt");
```
Now that the datatype has been instanciated, let's encode the number *987654321* by simply passing it to the `.encode` method:
```javascript
var encodedMessage = signedInteger.encode(987654321);
```
This will return the binary data stored in the **UTF-8** format, where every character encodes one byte (0-255). In this case, we get the string "ºÞh±". Passing this string back into the same Object using the `.decode` method
```javascript
var decodedMessage = signedInteger.decode("ºÞh±");
```
returns the original input, *987654321*.

Of course, BinaryJS allows for much more complex and nested data structures. 
**Example:**
```javascript
var carBlueprint = new Binary.Object({
    color: new Binary.String(),
    horsePower: new Binary.Number("uShort"),
    isSportscar: new Binary.Boolean(),
    specialFeatures: new Binary.Array([new Binary.String()], "byte")
});

var encodedFerrari = carBlueprint.encode({
    color: "red",
    horsePower: 745,
    isSportscar: true,
    specialFeatures: ["Vertical doors", "Surround sound"]
});
```
`encodedFerrari` in this case is only 38 bytes long, most of which are used up by its strings. In comparison, JSON.stringify()ing the same data yields a string length of 105 bytes.

## Installation
Simply load binary.js *or* binary_min.js using a <script> tag or require it using Node.
