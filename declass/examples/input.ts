export class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    console.log("Point created", x, y);
  }
  distance(other: Point) {
    return Math.sqrt(
      Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2),
    );
  }
}
export class Point3d {
  constructor(public x: number, public y: number, public z: number) {}
}
