import plusIcon from "./plus.svg?raw";
import minusIcon from "./minus.svg?raw";

export const rangeControl = (
  id: string,
  opts: {
    name: string;
    min: string;
    max: string;
    sliderMin: string;
    sliderMax: string;
  },
): {
  wrapper: HTMLElement;
  range: HTMLInputElement;
  input: HTMLInputElement;
} => {
  const range = (
    <input
      type="range"
      tabIndex={1}
      id={`${id}-range`}
      min={opts.min}
      max={opts.max}
    />
  ) as HTMLInputElement;

  const input = (
    <input
      type="number"
      id={id}
      name={id}
      min={opts.sliderMin}
      max={opts.sliderMax}
    />
  ) as HTMLInputElement;

  const wrapper = (
    <div className="range-input-wrapper">
      <label htmlFor={id}>{opts.name}</label>
      {range}
      <div className="range-input-value">{input}</div>
    </div>
  );

  return { wrapper, range, input };
};

export const stepper = (
  id: string,
  opts: { min: string; max: string; label: string },
) => (
  <div className="stepper-input-wrapper">
    <label htmlFor={id}>{opts.label}</label>
    <button id={`${id}-minus`} innerHTML={minusIcon}></button>
    <div className="stepper-input-value">
      <input type="number" id={id} name={id} min={opts.min} max={opts.max} />
    </div>
    <button id={`${id}-plus`} innerHTML={plusIcon}></button>
  </div>
);
