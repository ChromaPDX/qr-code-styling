import { DotType, Options, TypeNumber, ErrorCorrectionLevel, Mode, DrawType, Gradient } from "../types";
export interface RequiredOptions extends Options {
    type: DrawType;
    width: number;
    height: number;
    fit?: boolean;
    viewBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    margin: number;
    data: string;
    qrOptions: {
        typeNumber: TypeNumber;
        mode?: Mode;
        errorCorrectionLevel: ErrorCorrectionLevel;
    };
    bezel?: {
        depth: number;
        color?: string;
        colors?: string[];
    };
    imageOptions: {
        hideBackgroundDots: boolean;
        hideShape?: "square" | "radial";
        hideManualSize?: number;
        imageSize: number;
        crossOrigin?: string;
        margin: number;
    };
    dotsOptions: {
        type: DotType;
        color: string;
        gradient?: Gradient;
        scale?: number;
    };
    backgroundOptions: {
        color: string;
        gradient?: Gradient;
    };
}
declare const defaultOptions: RequiredOptions;
export default defaultOptions;
