import calculateImageSize from "../tools/calculateImageSize";
import errorCorrectionPercents from "../constants/errorCorrectionPercents";
import QRDot from "../figures/dot/svg/QRDot";
import QRCornerSquare from "../figures/cornerSquare/svg/QRCornerSquare";
import QRCornerDot from "../figures/cornerDot/svg/QRCornerDot";
import { RequiredOptions } from "./QROptions";
import gradientTypes from "../constants/gradientTypes";
import { QRCode, FilterFunction, Gradient } from "../types";

const squareMask = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1]
];

const dotMask = [
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0]
];

const truncateFloatToPlaces = (value: number, places: number) =>
  Math.floor(value * Math.pow(10, places)) / Math.pow(10, places);

const measureQr = (options: RequiredOptions, count: number) => {
  const { width, height, margin } = options;
  const minSize = Math.min(width, height) - margin * 2;
  const dotSize = truncateFloatToPlaces(minSize / count, 1);
  const xBeginning = truncateFloatToPlaces((options.width - count * dotSize) / 2, 1);
  const yBeginning = truncateFloatToPlaces((options.height - count * dotSize) / 2, 1);
  return {
    count,
    minSize,
    dotSize,
    xBeginning,
    yBeginning
  };
};

export default class QRSVG {
  _element: SVGElement;
  _defs: SVGElement;
  _dotsClipPath?: SVGElement;
  _cornersSquareClipPath?: SVGElement;
  _cornersDotClipPath?: SVGElement;
  _options: RequiredOptions;
  _qr?: QRCode;
  _image?: HTMLImageElement;

  //TODO don't pass all options to this class
  constructor(options: RequiredOptions) {
    this._element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const viewBox = options.bezel
      ? {
          x: -options.bezel.depth,
          y: -options.bezel.depth,
          width: options.width + options.bezel.depth,
          height: options.height + options.bezel.depth,
          ...options.viewBox
        }
      : {
          x: 0,
          y: 0,
          width: options.width,
          height: options.height,
          ...options.viewBox
        };
    this._element.setAttribute(
      "viewBox",
      `${String(viewBox.x)} ${String(viewBox.y)} ${String(viewBox.width)} ${String(viewBox.height)}`
    );
    if (!options.fit) {
      this._element.setAttribute("width", String(options.width));
      this._element.setAttribute("height", String(options.height));
    }

    this._defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    this._element.appendChild(this._defs);

    this._options = options;
  }

  get width(): number {
    return this._options.width;
  }

  get height(): number {
    return this._options.height;
  }

  getElement(): SVGElement {
    return this._element;
  }

  clear(): void {
    const oldElement = this._element;
    this._element = oldElement.cloneNode(false) as SVGElement;
    oldElement?.parentNode?.replaceChild(this._element, oldElement);
    this._defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    this._element.appendChild(this._defs);
  }

  async drawQR(qr: QRCode): Promise<void> {
    const count = qr.getModuleCount();
    const { dotSize } = measureQr(this._options, count);
    let drawImageSize = {
      hideXDots: 0,
      hideYDots: 0,
      width: 0,
      height: 0
    };

    this._qr = qr;

    if (this._options.image) {
      //We need it to get image size
      await this.loadImage();
      if (!this._image) return;
      const { imageOptions, qrOptions } = this._options;
      const coverLevel = imageOptions.imageSize * errorCorrectionPercents[qrOptions.errorCorrectionLevel];
      const maxHiddenDots = Math.floor(coverLevel * count * count);

      drawImageSize = calculateImageSize({
        originalWidth: this._image.width,
        originalHeight: this._image.height,
        maxHiddenDots,
        maxHiddenAxisDots: count - 14,
        dotSize
      });
    }

    this.clear();
    this.drawBackground();
    this.drawDots((i: number, j: number): boolean => {
      if (this._options.imageOptions.hideBackgroundDots) {
        if (this._options.imageOptions.hideShape === "radial") {
          const r = (drawImageSize.hideXDots || this._options?.imageOptions?.hideManualSize || 0) * 0.5;
          const center = count / 2;
          const d = Math.pow(r, 2) - (Math.pow(center - i, 2) + Math.pow(center - j, 2));
          // console.log({ r, d, i, j });
          if (d > 0) return false;
        } else {
          if (
            i >= (count - drawImageSize.hideXDots) / 2 &&
            i < (count + drawImageSize.hideXDots) / 2 &&
            j >= (count - drawImageSize.hideYDots) / 2 &&
            j < (count + drawImageSize.hideYDots) / 2
          ) {
            return false;
          }
        }
      }

      if (squareMask[i]?.[j] || squareMask[i - count + 7]?.[j] || squareMask[i]?.[j - count + 7]) {
        return false;
      }

      if (dotMask[i]?.[j] || dotMask[i - count + 7]?.[j] || dotMask[i]?.[j - count + 7]) {
        return false;
      }

      return true;
    });
    this.drawCorners();

    if (this._options.image) {
      this.drawImage({ width: drawImageSize.width, height: drawImageSize.height, count, dotSize });
    }
  }

  drawBackground(): void {
    const element = this._element;
    const options = this._options;

    if (element) {
      const gradientOptions = options.backgroundOptions?.gradient;
      const color = options.backgroundOptions?.color;

      if (gradientOptions || color) {
        this._createColor({
          options: gradientOptions,
          color: color,
          additionalRotation: 0,
          x: 0,
          y: 0,
          height: options.height,
          width: options.width,
          name: "background-color"
        });
      }
    }
    if (options.bezel) {
      const count = this._qr?.getModuleCount() || 0;
      const { dotSize, xBeginning, yBeginning } = measureQr(options, count);
      const color = options.bezel?.color || options.cornersSquareOptions?.color || "#000000";

      this._createBezel({
        options: options.bezel,
        dotSize,
        xBeginning,
        yBeginning,
        count,
        color: color,
        colors: options.cornersSquareOptions?.colors,
        additionalRotation: 0,
        x: 0,
        y: 0,
        height: options.height,
        width: options.width,
        name: "bezel"
      });
    }
  }

  drawDots(filter?: FilterFunction): void {
    if (!this._qr) {
      throw "QR code is not defined";
    }

    const options = this._options;
    const count = this._qr.getModuleCount();

    if (count > options.width || count > options.height) {
      throw "The canvas is too small.";
    }

    const { dotSize, xBeginning, yBeginning } = measureQr(options, count);

    const dot = new QRDot({ svg: this._element, type: options.dotsOptions.type });

    this._dotsClipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    this._dotsClipPath.setAttribute("id", "clip-path-dot-color");
    this._defs.appendChild(this._dotsClipPath);

    this._createColor({
      options: options.dotsOptions?.gradient,
      color: options.dotsOptions.color,
      additionalRotation: 0,
      x: xBeginning,
      y: yBeginning,
      height: count * dotSize,
      width: count * dotSize,
      name: "dot-color"
    });

    for (let i = 0; i < count; i++) {
      for (let j = 0; j < count; j++) {
        if (filter && !filter(i, j)) {
          continue;
        }
        if (!this._qr?.isDark(i, j)) {
          continue;
        }

        dot.draw(
          xBeginning + i * dotSize,
          yBeginning + j * dotSize,
          dotSize * (options.dotsOptions?.scale || 1.05),
          (xOffset: number, yOffset: number): boolean => {
            if (i + xOffset < 0 || j + yOffset < 0 || i + xOffset >= count || j + yOffset >= count) return false;
            if (filter && !filter(i + xOffset, j + yOffset)) return false;
            return !!this._qr && this._qr.isDark(i + xOffset, j + yOffset);
          }
        );

        if (dot._element && this._dotsClipPath) {
          this._dotsClipPath.appendChild(dot._element);
        }
      }
    }
  }

  drawCorners(): void {
    if (!this._qr) {
      throw "QR code is not defined";
    }

    const element = this._element;
    const options = this._options;

    if (!element) {
      throw "Element code is not defined";
    }

    const count = this._qr.getModuleCount();
    const { dotSize, xBeginning, yBeginning } = measureQr(options, count);
    const cornersSquareSize = dotSize * 7;
    const cornersDotSize = dotSize * 3;

    [
      [0, 0, 0],
      [1, 0, Math.PI / 2],
      [0, 1, -Math.PI / 2]
    ].forEach(([column, row, rotation], i) => {
      const x = xBeginning + column * dotSize * (count - 7);
      const y = yBeginning + row * dotSize * (count - 7);
      let cornersSquareClipPath = this._dotsClipPath;
      let cornersDotClipPath = this._dotsClipPath;

      if (
        options.cornersSquareOptions?.gradient ||
        options.cornersSquareOptions?.colors ||
        options.cornersSquareOptions?.color
      ) {
        cornersSquareClipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
        cornersSquareClipPath.setAttribute("id", `clip-path-corners-square-color-${column}-${row}`);
        this._defs.appendChild(cornersSquareClipPath);
        this._cornersSquareClipPath = this._cornersDotClipPath = cornersDotClipPath = cornersSquareClipPath;

        this._createColor({
          options: options.cornersSquareOptions?.gradient,
          color: options.cornersSquareOptions?.colors
            ? options.cornersSquareOptions?.colors[i]
            : options.cornersSquareOptions?.color,
          additionalRotation: rotation,
          x,
          y,
          height: cornersSquareSize,
          width: cornersSquareSize,
          name: `corners-square-color-${column}-${row}`
        });
      }

      if (options.cornersSquareOptions?.type) {
        const cornersSquare = new QRCornerSquare({ svg: this._element, type: options.cornersSquareOptions.type });
        cornersSquare.draw(x, y, cornersSquareSize, rotation);

        if (cornersSquare._element && cornersSquareClipPath) {
          cornersSquareClipPath.appendChild(cornersSquare._element);
        }

        // const cornersShadow = new QRCornerSquare({ svg: this._element, type: options.cornersSquareOptions.type });
        // cornersShadow.draw(x - 10, y - 10, cornersSquareSize, rotation);

        // if (cornersShadow._element && cornersSquareClipPath) {
        //   cornersSquareClipPath.appendChild(cornersShadow._element);
        // }
      } else {
        const dot = new QRDot({ svg: this._element, type: options.dotsOptions.type });

        for (let i = 0; i < squareMask.length; i++) {
          for (let j = 0; j < squareMask[i].length; j++) {
            if (!squareMask[i]?.[j]) {
              continue;
            }

            dot.draw(
              x + i * dotSize,
              y + j * dotSize,
              dotSize,
              (xOffset: number, yOffset: number): boolean => !!squareMask[i + xOffset]?.[j + yOffset]
            );

            if (dot._element && cornersSquareClipPath) {
              cornersSquareClipPath.appendChild(dot._element);
            }
          }
        }
      }

      if (options.cornersDotOptions?.gradient || options.cornersDotOptions?.color) {
        cornersDotClipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
        cornersDotClipPath.setAttribute("id", `clip-path-corners-dot-color-${column}-${row}`);
        this._defs.appendChild(cornersDotClipPath);
        this._cornersDotClipPath = cornersDotClipPath;

        this._createColor({
          options: options.cornersDotOptions?.gradient,
          color: options.cornersDotOptions?.color,
          additionalRotation: rotation,
          x: x + dotSize * 2,
          y: y + dotSize * 2,
          height: cornersDotSize,
          width: cornersDotSize,
          name: `corners-dot-color-${column}-${row}`
        });
      }

      if (options.cornersDotOptions?.type) {
        const cornersDot = new QRCornerDot({ svg: this._element, type: options.cornersDotOptions.type });

        cornersDot.draw(x + dotSize * 2, y + dotSize * 2, cornersDotSize, rotation);

        if (cornersDot._element && cornersDotClipPath) {
          cornersDotClipPath.appendChild(cornersDot._element);
        }
      } else {
        const dot = new QRDot({ svg: this._element, type: options.dotsOptions.type });

        for (let i = 0; i < dotMask.length; i++) {
          for (let j = 0; j < dotMask[i].length; j++) {
            if (!dotMask[i]?.[j]) {
              continue;
            }

            dot.draw(
              x + i * dotSize,
              y + j * dotSize,
              dotSize,
              (xOffset: number, yOffset: number): boolean => !!dotMask[i + xOffset]?.[j + yOffset]
            );

            if (dot._element && cornersDotClipPath) {
              cornersDotClipPath.appendChild(dot._element);
            }
          }
        }
      }
    });
  }

  loadImage(): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = this._options;

      if (!options.image) {
        return reject("Image is not defined");
      }

      const image = new Image();

      if (typeof options.imageOptions.crossOrigin === "string") {
        image.crossOrigin = options.imageOptions.crossOrigin;
      }

      this._image = image;
      image.onload = (): void => {
        resolve();
      };
      image.src = options.image;
    });
  }

  drawImage({
    width,
    height,
    count,
    dotSize
  }: {
    width: number;
    height: number;
    count: number;
    dotSize: number;
  }): void {
    const options = this._options;
    const xBeginning = Math.floor((options.width - count * dotSize) / 2);
    const yBeginning = Math.floor((options.height - count * dotSize) / 2);
    const dx = xBeginning + options.imageOptions.margin + (count * dotSize - width) / 2;
    const dy = yBeginning + options.imageOptions.margin + (count * dotSize - height) / 2;
    const dw = width - options.imageOptions.margin * 2;
    const dh = height - options.imageOptions.margin * 2;

    if (typeof options?.image == "string") {
      const imageString = options.image as string;
      let svgString;
      if (imageString?.indexOf("data:image/svg+xml;base64,") !== -1) {
        const b64 = imageString.replace("data:image/svg+xml;base64,", "");
        svgString = Buffer.from(b64, "base64").toString("utf8");
      } else {
        svgString = imageString;
      }
      // console.log("image is svgString", svgString);
      let g = document.createElement("g");
      g.innerHTML = svgString;
      try {
        const innerSvg = g.getElementsByTagName("svg");
        const innerG = innerSvg[0].getElementsByTagName("g")[0];
        if (innerG) g = innerG as any;
        else {
          // console.log("nested svg does not wrap G");
        }
      } catch (e) {
        console.log("bad svg image element");
      }
      g.setAttribute("transform", `translate(${dx}, ${dy})`);
      // g.setAttribute("y", String(dy));
      // g.setAttribute("width", `${dw}px`);
      // g.setAttribute("height", `${dh}px`);
      // g.appendChild(g);
      // console.log("append element", g);
      this._element.appendChild(g);
    } else if (options.imageOptions) {
      const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
      image.setAttribute("href", options.image || "");
      image.setAttribute("x", String(dx));
      image.setAttribute("y", String(dy));
      image.setAttribute("width", `${dw}px`);
      image.setAttribute("height", `${dh}px`);

      this._element.appendChild(image);
    }
  }

  _createColor({
    options,
    color,
    additionalRotation,
    x,
    y,
    height,
    width,
    name
  }: {
    options?: Gradient;
    color?: string;
    additionalRotation: number;
    x: number;
    y: number;
    height: number;
    width: number;
    name: string;
  }): void {
    const size = width > height ? width : height;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("height", String(height));
    rect.setAttribute("width", String(width));
    rect.setAttribute("clip-path", `url('#clip-path-${name}')`);

    if (options) {
      let gradient: SVGElement;
      if (options.type === gradientTypes.radial) {
        gradient = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        gradient.setAttribute("id", name);
        gradient.setAttribute("gradientUnits", "userSpaceOnUse");
        gradient.setAttribute("fx", String(x + width / 2));
        gradient.setAttribute("fy", String(y + height / 2));
        gradient.setAttribute("cx", String(x + width / 2));
        gradient.setAttribute("cy", String(y + height / 2));
        gradient.setAttribute("r", String(size / 2));
      } else {
        const rotation = ((options.rotation || 0) + additionalRotation) % (2 * Math.PI);
        const positiveRotation = (rotation + 2 * Math.PI) % (2 * Math.PI);
        let x0 = x + width / 2;
        let y0 = y + height / 2;
        let x1 = x + width / 2;
        let y1 = y + height / 2;

        if (
          (positiveRotation >= 0 && positiveRotation <= 0.25 * Math.PI) ||
          (positiveRotation > 1.75 * Math.PI && positiveRotation <= 2 * Math.PI)
        ) {
          x0 = x0 - width / 2;
          y0 = y0 - (height / 2) * Math.tan(rotation);
          x1 = x1 + width / 2;
          y1 = y1 + (height / 2) * Math.tan(rotation);
        } else if (positiveRotation > 0.25 * Math.PI && positiveRotation <= 0.75 * Math.PI) {
          y0 = y0 - height / 2;
          x0 = x0 - width / 2 / Math.tan(rotation);
          y1 = y1 + height / 2;
          x1 = x1 + width / 2 / Math.tan(rotation);
        } else if (positiveRotation > 0.75 * Math.PI && positiveRotation <= 1.25 * Math.PI) {
          x0 = x0 + width / 2;
          y0 = y0 + (height / 2) * Math.tan(rotation);
          x1 = x1 - width / 2;
          y1 = y1 - (height / 2) * Math.tan(rotation);
        } else if (positiveRotation > 1.25 * Math.PI && positiveRotation <= 1.75 * Math.PI) {
          y0 = y0 + height / 2;
          x0 = x0 + width / 2 / Math.tan(rotation);
          y1 = y1 - height / 2;
          x1 = x1 - width / 2 / Math.tan(rotation);
        }

        gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        gradient.setAttribute("id", name);
        gradient.setAttribute("gradientUnits", "userSpaceOnUse");
        gradient.setAttribute("x1", String(Math.round(x0)));
        gradient.setAttribute("y1", String(Math.round(y0)));
        gradient.setAttribute("x2", String(Math.round(x1)));
        gradient.setAttribute("y2", String(Math.round(y1)));
      }

      options.colorStops.forEach(({ offset, color }: { offset: number; color: string }) => {
        const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop.setAttribute("offset", `${100 * offset}%`);
        stop.setAttribute("stop-color", color);
        gradient.appendChild(stop);
      });

      rect.setAttribute("fill", `url('#${name}')`);
      this._defs.appendChild(gradient);
    } else if (color) {
      rect.setAttribute("fill", color);
    }

    this._element.appendChild(rect);
  }

  _createBezel({
    options,
    color,
    colors,
    count,
    height,
    width,
    xBeginning,
    yBeginning,
    dotSize
  }: {
    options: {
      depth: number;
      strokeWidth?: number;
      strokeLineCap?: string;
    };
    xBeginning: number;
    yBeginning: number;
    dotSize: number;
    count: number;
    color: string;
    colors?: string[];
    additionalRotation: number;
    x: number;
    y: number;
    height: number;
    width: number;
    name: string;
  }): void {
    const sw = options?.strokeWidth || 3;
    const _depth = options.depth - sw / 3;
    // const _name = name || 'bezel';
    const squares = [
      {
        center: [0, 0],
        lines: [
          [0, 0],
          [1, 0],
          [0, 1]
        ],
        color: colors ? colors[0] : color
      },
      {
        center: [1, 0],
        lines: [
          [0, 0],
          [1, 0]
        ],
        color: colors ? colors[1] : color
      },
      {
        center: [0, 1],
        lines: [
          [0, 0],
          [0, 1]
        ],
        color: colors ? colors[2] : color
      }
    ];
    for (const s of squares) {
      const middleL = dotSize * (count - 7);
      const ss = dotSize * 6.5;
      const cx = s.center[0] * middleL;
      const cy = s.center[1] * middleL;
      for (const l of s.lines) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const _x = xBeginning + cx + l[0] * ss;
        const _y = yBeginning + cy + l[1] * ss;
        line.setAttribute("x1", String(_x));
        line.setAttribute("y1", String(_y));
        line.setAttribute("x2", String(_x - _depth));
        line.setAttribute("y2", String(_y - _depth));
        line.setAttribute("stroke", s.color);
        line.setAttribute("stroke-width", String(sw ? sw / 2 : 2));
        line.setAttribute("stroke-linecap", options?.strokeLineCap || "square");
        // rect.setAttribute("height", String(height));
        // rect.setAttribute("width", String(width));
        // line.setAttribute("clip-path", `url('#clip-path-${_name}')`);
        this._element.appendChild(line);
      }
    }
    const edges = [
      [
        [0, 0],
        [1, 0]
      ],
      [
        [0, 0],
        [0, 1]
      ]
    ];
    for (const lineSegment of edges) {
      const [sv, ev] = lineSegment;
      const _depth = options.depth;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(sv[0] * width - _depth));
      line.setAttribute("y1", String(sv[1] * height - _depth));
      line.setAttribute("x2", String(ev[0] * width - _depth - (sw / 6) * ev[0]));
      line.setAttribute("y2", String(ev[1] * height - _depth - (sw / 6) * ev[1]));
      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", String(sw || 4));
      // line.setAttribute("stroke-linecap", "round");
      // rect.setAttribute("height", String(height));
      // rect.setAttribute("width", String(width));
      // line.setAttribute("clip-path", `url('#clip-path-${_name}')`);
      this._element.appendChild(line);
    }
    // console.log("create bezel!", this._element);
  }
}
