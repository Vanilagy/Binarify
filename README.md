# Binarify
Binarify is an easy-to-use JavaScript library for encoding complex data structures into compact, space-saving binary data and back.

The issue with sending data as JSON (or any other serialized format) is that it not only sends the data, but also the data structure every time. Additionally, all data is simply sent in string format and not in its actual byte representation. That's a waste of bandwidth, and bandwidth is limited. [Binary protocols](https://en.wikipedia.org/wiki/Binary_protocol) on the other hand send data in its raw bytes, which makes it faster for both networks and computers. The only downside is that a binary protocol is not human-readable and usually quite complex.

This is where Binarify comes in: **It allows you to define your own binary protocol, and therefore is meant to simplify binary communication for real-time web applications where network efficiency is key.** Since more generally, Binarify is used to specify a binary format, it can also be used for non-network applications, such as creating binary files.

## Functionality
[Read full documentation](./docs/documentation.md)

Prior to sending and receiving data, a data structure first has to be defined by the user, which will act as its own unique binary format used to encode and decode the use-specific data. For this, Binarify has multiple different data and structure types.

**Example:**
```javascript
var signedInteger = new Binarify.Number("s32");
```
Now that the datatype has been instanciated, let's encode the number *987654321* by simply passing it and the Converter to Binarify's `.encode` method:
```javascript
var encodedMessage = Binarify.encode(signedInteger, 987654321);
```
This will return the binary data stored in an ArrayBuffer (or Buffer on Node) format. In this case, we get the bytes `[177, 104, 222, 58]`. Passing this buffer back into Binarify's `.decode` method
```javascript
var decodedMessage = Binarify.decode(signedInteger, encodedMessage);
```
returns the original input, *987654321*.

**The idea is that both the server and the client define the same data structures; that way, what the server encodes can be decoded by the client, and vice-versa.**

Of course, Binarify allows for much more complex and nested data structures. 
**Example:**
```javascript
var carBlueprint = new Binarify.Object({
    color: new Binarify.String(),
    horsePower: new Binarify.Number("u32"),
    isSportscar: new Binarify.Boolean(),
    specialFeatures: new Binarify.Array(new Binarify.String(), "u8")
});

var ferrari = {
    color: "red",
    horsePower: 745,
    isSportscar: true,
    specialFeatures: ["Vertical doors", "Surround sound"]
};

var encodedFerrari = Binarify.encode(carBlueprint, ferrari);
```
`encodedFerrari` in this case is only 38 bytes long, most of which are used up by its strings. In comparison, JSON.stringify()ing the same data yields a string length of 105 bytes.

## Installation
Simply load binarify.js or binarify_min.js using a <script> tag, or require the file using Node.