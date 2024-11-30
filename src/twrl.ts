export type Component = HTMLElement;

export type Extract<As> = As extends []
  ? []
  : As extends [Dyn<infer A0>, ...infer More]
    ? [A0, ...Extract<More>]
    : never;

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

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

  static sequence<Ds, As extends Extract<Mutable<Ds>>>(vs: Ds): Dyn<As> {
    // @ts-ignore
    const seqed = new Dyn(vs.map((x) => x.latest)) as Dyn<As>;
    // @ts-ignore
    vs.forEach((v, ix) => {
      // @ts-ignore
      v.addListener((v) => {
        // @ts-ignore
        const vals = vs.map((x) => x.latest);
        // @ts-ignore
        vals[ix] = v;
        // @ts-ignore
        seqed.send(vals);
      });
    });

    return seqed;
  }

  map<B>(
    opts: ((a: A) => B) | { f: (a: A) => B | typeof Dyn.unchanged; def: B },
  ): Dyn<B> {
    const { handleValue, latest } = this.__handleMapOpts(opts);

    const input = new Dyn<B>(latest);

    this.listeners.push((value: A) =>
      handleValue({ send: (a: B) => input.send(a), value }),
    );

    return input;
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
