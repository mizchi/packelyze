export type Animal = "dog" | "cat" | "bird";

type InternalAnimalInfo = {
  dog: { sound: "bark" };
  cat: { sound: "meow" };
  bird: { sound: "chirp" };
};

export type PublicAnimalInfo = {
  [K in Animal]: { name: K; sound: InternalAnimalInfo[K]["sound"] };
};

type Flatten<T> = T extends { sound: infer S } ? S : never;

export type AnimalSounds = {
  [K in Animal]: Flatten<PublicAnimalInfo[K]>;
};

// Use of the types
let myDog: PublicAnimalInfo["dog"] = { name: "dog", sound: "bark" };
let myCat: PublicAnimalInfo["cat"] = { name: "cat", sound: "meow" };
export let myBird: PublicAnimalInfo["bird"] = { name: "bird", sound: "chirp" };

let sounds: AnimalSounds = {
  dog: myDog.sound,
  cat: myCat.sound,
  bird: myBird.sound,
};

export { sounds };
