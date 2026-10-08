export class WindSystem {
  strength = 0.45;
  time = 0;
  gust = 0;
  update(dt: number) {
    this.time += dt;
    this.gust =
      this.strength *
      (0.75 +
        0.2 * Math.sin(this.time * 0.31) +
        0.15 * Math.pow(Math.max(0, Math.sin(this.time * 0.17)), 4));
  }
}
