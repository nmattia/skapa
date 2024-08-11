export type Component = HTMLElement;

export class Dyn<A> {
  public latest: A;

  private listeners: ((a: A) => void)[] = [];

  static readonly unchanged = Symbol("unchanged");

  // Constructor with latest which is "initial" and then latest
  constructor(initial: A, listeners?: Dyn<A>["listeners"]) {
    if (listeners !== undefined) {
      this.listeners = listeners;
    }
    this.latest = initial;
    this.send(initial); // latest will be set twice but we don't care
  }

  addListener(f: (a: A) => void, updateNow = true) {
    this.listeners.push(f);
    if (updateNow) {
      f(this.latest);
    }
  }

  send(a: A) {
    this.listeners.forEach((listener) => listener(a));

    // and set as latest
    this.latest = a;
  }

  static zip3<A, B, C>(a: Dyn<A>, b: Dyn<B>, c: Dyn<C>): Dyn<[A, B, C]> {
    const zipped = new Dyn<[A, B, C]>([a.latest, b.latest, c.latest]);
    a.addListener((v: A) => zipped.send([v, b.latest, c.latest]), false);
    b.addListener((v: B) => zipped.send([a.latest, v, c.latest]), false);
    c.addListener((v: C) => zipped.send([a.latest, b.latest, v]), false);

    return zipped;
  }

  static zip4<A, B, C, D>(
    a: Dyn<A>,
    b: Dyn<B>,
    c: Dyn<C>,
    d: Dyn<D>,
  ): Dyn<[A, B, C, D]> {
    const zipped = new Dyn<[A, B, C, D]>([
      a.latest,
      b.latest,
      c.latest,
      d.latest,
    ]);
    a.addListener(
      (v: A) => zipped.send([v, b.latest, c.latest, d.latest]),
      false,
    );
    b.addListener(
      (v: B) => zipped.send([a.latest, v, c.latest, d.latest]),
      false,
    );
    c.addListener(
      (v: C) => zipped.send([a.latest, b.latest, v, d.latest]),
      false,
    );
    d.addListener(
      (v: D) => zipped.send([a.latest, b.latest, c.latest, v]),
      false,
    );

    return zipped;
  }

  static zip5<A, B, C, D, E>(
    a: Dyn<A>,
    b: Dyn<B>,
    c: Dyn<C>,
    d: Dyn<D>,
    e: Dyn<E>,
  ): Dyn<[A, B, C, D, E]> {
    const zipped = new Dyn<[A, B, C, D, E]>([
      a.latest,
      b.latest,
      c.latest,
      d.latest,
      e.latest,
    ]);
    a.addListener(
      (v: A) => zipped.send([v, b.latest, c.latest, d.latest, e.latest]),
      false,
    );
    b.addListener(
      (v: B) => zipped.send([a.latest, v, c.latest, d.latest, e.latest]),
      false,
    );
    c.addListener(
      (v: C) => zipped.send([a.latest, b.latest, v, d.latest, e.latest]),
      false,
    );
    d.addListener(
      (v: D) => zipped.send([a.latest, b.latest, c.latest, v, e.latest]),
      false,
    );
    e.addListener(
      (v: E) => zipped.send([a.latest, b.latest, c.latest, d.latest, v]),
      false,
    );

    return zipped;
  }

  static zip6<A, B, C, D, E, F>(
    a: Dyn<A>,
    b: Dyn<B>,
    c: Dyn<C>,
    d: Dyn<D>,
    e: Dyn<E>,
    f: Dyn<F>,
  ): Dyn<[A, B, C, D, E, F]> {
    const zipped = new Dyn<[A, B, C, D, E, F]>([
      a.latest,
      b.latest,
      c.latest,
      d.latest,
      e.latest,
      f.latest,
    ]);
    a.addListener(
      (v: A) =>
        zipped.send([v, b.latest, c.latest, d.latest, e.latest, f.latest]),
      false,
    );
    b.addListener(
      (v: B) =>
        zipped.send([a.latest, v, c.latest, d.latest, e.latest, f.latest]),
      false,
    );
    c.addListener(
      (v: C) =>
        zipped.send([a.latest, b.latest, v, d.latest, e.latest, f.latest]),
      false,
    );
    d.addListener(
      (v: D) =>
        zipped.send([a.latest, b.latest, c.latest, v, e.latest, f.latest]),
      false,
    );
    e.addListener(
      (v: E) =>
        zipped.send([a.latest, b.latest, c.latest, d.latest, v, f.latest]),
      false,
    );
    f.addListener(
      (v: F) =>
        zipped.send([a.latest, b.latest, c.latest, d.latest, e.latest, v]),
      false,
    );

    return zipped;
  }

  // How the mapped chan should handle the value
  protected __handleMapOpts<B>(
    opts: ((a: A) => B) | { f: (a: A) => B | typeof Dyn.unchanged; def: B },
  ): {
    handleValue: (arg: { send: (b: B) => void; value: A }) => void;
    latest: B;
  } {
    if (typeof opts === "function") {
      // Case of a simple mapper
      const f = opts;
      return {
        handleValue: ({ send, value }) => send(f(value)),
        latest: f(this.latest),
      };
    }

    // Advanced case with "unchanged" handling, where sending is skipped on "unchanged" (and initial/latest value may
    // be set to "def")
    const result = opts.f(this.latest);

    return {
      handleValue: ({ send, value }) => {
        const result = opts.f(value);
        if (result !== Dyn.unchanged) {
          send(result);
        }
      },
      latest: result === Dyn.unchanged ? opts.def : result,
    };
  }
}
