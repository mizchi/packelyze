function subFunction(sub) {
  return `${sub.id}: ${sub.subValue}`;
}

function nestedFunction(nested) {
  return `${nested.id}: ${nested.nestedValue}`;
}

function publicFunction(pub) {
  return `${pub.id}: ${pub.pubValue}`;
}
function k(internal) {
  return `${internal.name}: ${internal.age}`;
}
function allExportedFunction(pub, internal) {
  return publicFunction(pub) + ", " + k(internal);
}

export { allExportedFunction, nestedFunction, publicFunction, subFunction };
