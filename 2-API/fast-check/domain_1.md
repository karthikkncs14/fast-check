[Home](/) &gt; [fast-check](../fast-check.md) &gt; [domain](domain_1.md)

## domain() function

For domains having an extension with at least two lowercase characters

According to RFC 1034, RFC 1123 and WHATWG URL Standard - https://www.ietf.org/rfc/rfc1034.txt - https://www.ietf.org/rfc/rfc1123.txt - https://url.spec.whatwg.org/

<b>Signature:</b>

```typescript
export declare function domain(): Arbitrary<string>;
```
<b>Returns:</b>

`Arbitrary<string>`
