'use strict';

// Utils
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import debugInstance from 'debug';
const debug = debugInstance('canvas:synapsd:bitmap');

// Includes
const { RoaringBitmap32 } = require('roaring/RoaringBitmap32');

class Bitmap extends RoaringBitmap32 {
    constructor(oidArrayOrBitmap = [], options = {}) {
        super(oidArrayOrBitmap);

        if (!options.key) {
            throw new Error('Bitmap key required');
        }
        this.key = options.key;
        this.rangeMin = options.rangeMin ?? 0;
        this.rangeMax = options.rangeMax ?? 4294967296;

        debug(`Bitmap "${this.key}" ID range: ${this.rangeMin} - ${this.rangeMax} initialized`);
        debug(`Bitmap "${this.key}" has ${this.size} objects`);
    }

    tick(oid) {
        this.#validateOid(oid);
        this.add(oid);
    }

    untick(oid) {
        this.#validateOid(oid);
        this.remove(oid);
    }

    static create(oidArrayOrBitmap, options = {}) {
        options = {
            type: 'static',
            rangeMin: 0,
            rangeMax: 4294967296,
            ...options,
        };

        Bitmap.validateRange(oidArrayOrBitmap, options.rangeMin, options.rangeMax);
        return new Bitmap(oidArrayOrBitmap, options);
    }

    static validateRange(inputData, rangeMin = 0, rangeMax = 4294967296) {
        if (rangeMin < 0 || rangeMax < 0 || rangeMin > rangeMax) {
            throw new Error(`Invalid range: ${rangeMin} - ${rangeMax}`);
        }

        const validateOid = (oid) => {
            if (oid < rangeMin || oid > rangeMax) {
                throw new Error(`ID out of range: ${oid}, range: ${rangeMin} - ${rangeMax}`);
            }
        };

        if (typeof inputData === 'number') {
            validateOid(inputData);
        } else if (Array.isArray(inputData)) {
            inputData.forEach(validateOid);
        } else if (inputData instanceof RoaringBitmap32) {
            validateOid(inputData.minimum());
            validateOid(inputData.maximum());
        } else {
            throw new Error(`Invalid input data: ${inputData}`);
        }
    }

    #validateOid(oid) {
        if (oid < this.rangeMin || oid > this.rangeMax) {
            throw new Error(`Object ID ${oid} not within range: ${this.rangeMin} - ${this.rangeMax}`);
        }
    }

    #validateArray(oidArray) {
        if (!Array.isArray(oidArray)) {
            throw new Error(`Not an array: ${oidArray}`);
        }
        if (oidArray.length === 0) return;

        const minOid = Math.min(...oidArray);
        const maxOid = Math.max(...oidArray);
        if (minOid < this.rangeMin || maxOid > this.rangeMax) {
            throw new Error(`Array contains out of range values. Range: ${this.rangeMin} - ${this.rangeMax}`);
        }
    }

    #validateBitmap(bitmap) {
        if (!(bitmap instanceof RoaringBitmap32)) {
            throw new Error(`Not a RoaringBitmap32 instance: ${bitmap}`);
        }
        const minId = bitmap.minimum();
        const maxId = bitmap.maximum();
        if (minId < this.rangeMin || maxId > this.rangeMax) {
            throw new Error(`Bitmap contains out of range values. Range: ${this.rangeMin} - ${this.rangeMax}`);
        }
    }
}

export default Bitmap;
