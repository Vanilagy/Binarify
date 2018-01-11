# BinaryJS
BinaryJS is an easy-to-use JavaScript framework for encoding complex data structures into compact, bandwidth-saving binary data and back. It is meant to simplify communication for real-time web appliactions where network efficiency is key.

## Functionality
[Read full documentation](./ref/reference.md)

Prior to sending and receiving data, a data structure first has to be defined by the user, which will act as it's own unique binary protocol used to encode and decode the use-specific data. For this, BinaryJS has multiple different data and structure types, each sporting their own `.encode` and `.decode` methods.

**Example:**
```javascript
var signedInteger = new binary.Number("sInt");
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
var carBlueprint = new binary.Object({
    color: new binary.String(),
    horsePower: new binary.Number("uShort"),
    isSportscar: new binary.Boolean(),
    specialFeatures: new binary.Array([new binary.String()], "byte")
});

var ferrari = {
    color: "red",
    horsePower: 745,
    isSportscar: true,
    specialFeatures: ["Vertical doors", "Surround sound"]
};

var encodedFerrari = carBlueprint.encode(ferrari);
```
`encodedFerrari` in this case is only 38 bytes long, most of which are used up by its strings. In comparison, JSON.stringify()ing the same data yields a string length of 105 bytes.

## Installation
Simply load binary.js *or* binary_min.js using a <script> tag or require it using Node.
