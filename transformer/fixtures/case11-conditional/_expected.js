// Use of the types
let y = { name: "dog", sound: "bark" };
let w = { name: "cat", sound: "meow" };
let myBird = { name: "bird", sound: "chirp" };
let g = {
  dog: y.sound,
  cat: w.sound,
  bird: myBird.sound,
};

export { myBird, g as sounds };
