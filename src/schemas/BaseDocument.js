'use strict';

// Utils
import { z } from 'zod';
import {
    parseISO,
    isToday,
    isYesterday,
    isThisWeek,
    isThisISOWeek,
    isThisMonth,
    isThisQuarter,
    isThisYear,
} from 'date-fns';
import { generateChecksum } from '../utils/crypto.js';

// Constants
const DOCUMENT_SCHEMA = 'data/abstraction/document';
const DOCUMENT_SCHEMA_VERSION = '2.0';
const DOCUMENT_DATA_CHECKSUM_ALGORITHMS = ['sha1', 'sha256'];
const DEFAULT_DOCUMENT_DATA_TYPE = 'application/json';
const DEFAULT_DOCUMENT_DATA_ENCODING = 'utf8';

// Base document schema definition
const documentSchema = z.object({
    // Base
    schema: z.string(),
    schemaVersion: z.string(),

    // Internal index configuration
    indexOptions: z.object({
        checksumAlgorithms: z.array(z.string()),
        checksumFields: z.array(z.string()),
        searchFields: z.array(z.string()),
        embeddingFields: z.array(z.string()),
        embeddingModel: z.string(),
        embeddingDimensions: z.number(),
        embeddingProvider: z.string(),
        embeddingProviderOptions: z.record(z.any()),
        chunking: z.object({
            type: z.enum(['sentence', 'paragraph', 'chunk']),
            chunkSize: z.number(),
            chunkOverlap: z.number(),
        }),
    }),

    // Timestamps
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),

    // Metadata section
    metadata: z.object({
        dataContentType: z.string(),
        dataContentEncoding: z.string()
    }).and(z.record(z.any())), // Allow additional metadata fields

    // This is actually a checksum string array checksumAlgo/checksumValue,
    // maybe we should rename or refactor this part!
    checksumArray: z.array(z.string()),

    // Document data/payload
    data: z.record(z.any()),
    dataPaths: z.array(z.string()).optional(),

    // Versioning
    // We _could_ use version support by LMDB, but went with a naive backend-agnostic approach
    parent_id: z.string().nullable(),
    versions: z.array(z.any()),
    version_number: z.number().int().positive(),
    latest_version: z.number().int().positive()
});

export default class BaseDocument {
    static schemaType = 'base';

    constructor(options = {}) {
        // Base
        this.id = null;
        this.schema = options.schema ?? DOCUMENT_SCHEMA;
        this.schemaVersion = options.schemaVersion ?? DOCUMENT_SCHEMA_VERSION;

        // Timestamps
        this.created_at = options.created_at ?? new Date().toISOString();
        this.updated_at = new Date().toISOString();

        // Internal index configuration
        this.indexOptions = {
            checksumAlgorithms: options?.index?.checksumAlgorithms ?? DOCUMENT_DATA_CHECKSUM_ALGORITHMS,
            checksumFields: options?.index?.checksumFields || ['data'],
            searchFields: options?.index?.searchFields || ['data'],
            embeddingFields: options?.index?.embeddingFields || ['data'],
            embeddingModel: options?.index?.embeddingModel || 'gte-Qwen2-1.5B-instruct',
            embeddingDimensions: options?.index?.embeddingDimensions || 8960,
            embeddingProvider: options?.index?.embeddingProvider || 'canvas',
        };

        /**
         * Metadata section
         */

        this.metadata = {
            dataContentType: options.meta?.dataContentType ?? DEFAULT_DOCUMENT_DATA_TYPE,
            dataContentEncoding: options.meta?.dataContentEncoding ?? DEFAULT_DOCUMENT_DATA_ENCODING,
            ...options.meta,
        };


        /**
         * Document data/payload, omitted for blobs
         */

        this.data = options.data ?? {};
        this.dataPaths = options.dataPaths ?? [];

        /**
         * Versioning
         */

        this.parent_id = options.parent_id ?? null; // Stored in the child document
        this.versions = options.versions ?? []; // Stored in the parent document
        this.version_number = options.version_number ?? 1;
        this.latest_version = options.latest_version ?? 1; // Stored in the parent document

        // Generate checksums
        this.checksumArray = options.checksumArray ?? this.generateChecksumStrings();

        // Embeddings can be supplied or generated on-demand as model: [embeddings]
        this.embeddings = options.embeddings ?? {};

        // Validate document
        this.validate();
    }

    update(document) {
        Object.assign(this, document);
        this.updated_at = new Date().toISOString();
    }

    /**
     * Data helpers
     */

    generateChecksumStrings() {
        const checksumData = this.generateChecksumData();
        return this.indexOptions.checksumAlgorithms.map((algorithm) => {
            return `${algorithm}/${generateChecksum(checksumData, algorithm)}`;
        });
    }

    generateChecksumData() {
        try {
            // Default to the whole data object if no specific fields are set
            if (!this.indexOptions?.checksumFields?.length ||
                this.indexOptions.checksumFields.includes('data')) {
                return this.data ? JSON.stringify(this.data) : '';
            }

            // Extract and concatenate specified fields
            const fieldValues = this.indexOptions.checksumFields
                .map((field) => {
                    const value = this.getNestedValue(this, field);
                    return value !== undefined ? JSON.stringify(value) : '';
                })
                .filter(Boolean);  // Remove empty strings

            return fieldValues.join('');
        } catch (error) {
            console.error('Error generating checksum data:', error);
            return '';
        }
    }

    generateFtsData() {
        try {
            if (!this.indexOptions?.searchFields?.length) return null;

            // Extract specified fields
            const fieldValues = this.indexOptions.searchFields
                .map((field) => {
                    const value = this.getNestedValue(this, field);
                    return value ? String(value).trim() : null;
                })
                .filter(Boolean);  // Remove null/empty values

            return fieldValues.length > 0 ? fieldValues : null;
        } catch (error) {
            console.error('Error generating FTS data:', error);
            return null;
        }
    }

    generateEmbeddingsData() {
        try {
            if (!this.indexOptions?.embeddingFields?.length) return null;

            // Extract specified fields
            const fieldValues = this.indexOptions.embeddingFields
                .map((field) => {
                    const value = this.getNestedValue(this, field);
                    return value || null;
                })
                .filter(Boolean);  // Remove null values

            return fieldValues.length > 0 ? fieldValues : null;
        } catch (error) {
            console.error('Error generating embeddings data:', error);
            return null;
        }
    }

    /**
     * Versioning helpers
    */

    addVersion(version) {
        // Naive implementation:
        // Object has a parent_id, empty parent_id means root document
        // Object has a versions array with object IDs of previous versions
    }

    removeVersion(version) { }

    /**
     * Utils
     */

    static isWithinTimeFrame(dateString, timeFrameIdentifier) {
        const date = parseISO(dateString);
        const timeFrameChecks = {
            today: isToday,
            yesterday: isYesterday,
            thisWeek: isThisWeek,
            thisISOWeek: isThisISOWeek,
            thisMonth: isThisMonth,
            thisQuarter: isThisQuarter,
            thisYear: isThisYear,
        };

        return timeFrameChecks[timeFrameIdentifier]?.(date) ?? false;
    }

    static validate(document) {
        return documentSchema.parse(document);
    }

    toJSON() {
        return {
            // Base
            id: this.id,
            schema: this.schema,
            schemaVersion: this.schemaVersion,

            // Timestamps
            created_at: this.created_at,
            updated_at: this.updated_at,

            // Internal index configuration
            indexOptions: this.indexOptions,

            // Metadata section
            metadata: this.metadata,
            checksumArray: this.checksumArray,
            embeddings: this.embeddings,
            features: this.features,
            paths: this.paths,

            // Document data/payload, omitted for blobs
            data: this.data,

            // Versioning
            parent_id: this.parent_id,
            versions: this.versions,
            version_number: this.version_number,
            latest_version: this.latest_version,
        };
    }

    static toJSON() {
        return JSON.stringify({
            // Base

        });
    }

    static fromJSON(json) {
        const doc = new BaseDocument({  // Changed from Document to BaseDocument
            ...json,
            checksumArray: Array.isArray(json.checksumArray) ? json.checksumArray : [],
            features: Array.isArray(json.features) ? json.features : [],
            embeddings: json.embeddings,
            data: json.data,
        });

        return doc;
    }

    /**
     * Validates the document structure and data
     * @throws {Error} If validation fails
     * @returns {boolean} True if validation passes
     */
    validate() {
        try {
            // Validate using Zod schema
            BaseDocument.schemaDefinition.parse(this);

            // Additional validation
            if (!this.data) {
                throw new Error('Document data is required');
            }

            if (!this.indexOptions?.checksumFields?.length) {
                throw new Error('At least one checksum field must be specified');
            }

            return true;
        } catch (error) {
            throw new Error(`Document validation failed: ${error.message}`);
        }
    }

    static get schemaDefinition() {
        return documentSchema;
    }

    get schemaDefinition() {
        return BaseDocument.schemaDefinition;
    }

    isJsonDocument() {
        return this.metadata.dataContentType === 'application/json';
    }

    // TODO: Fixme, this assumes everything other than a blob is stored as JSON which may not be the case
    isBlob() {
        return this.metadata.dataContentType !== 'application/json';
    }

    getNestedValue(obj, path) {
        if (!obj || !path) return undefined;

        try {
            return path.split('.').reduce((current, key) => {
                if (current === null || current === undefined) return undefined;
                return current[key];
            }, obj);
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Create a document from input data
     * @param {Object} input Input data
     * @param {Object} options Additional options
     * @returns {BaseDocument} New document instance
     */
    static fromData(input, options = {}) {
        return this.create({
            data: this.normalizeInputData(input),
            ...options
        });
    }

    /**
     * Factory method to create documents from normalized input
     * @protected
     */
    static create(options = {}) {
        return new this(options);
    }

    /**
     * Normalize input data based on document type
     * @protected
     */
    static normalizeInputData(input) {
        if (typeof input !== 'object' || input === null) {
            throw new Error('Base documents require object input');
        }
        return input;
    }
}
