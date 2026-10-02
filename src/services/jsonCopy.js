// A deep copy in exactly the form a save stores: plain data only, without undefined
// values, functions or class instances. Use it before persisting or comparing saves.
export const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
