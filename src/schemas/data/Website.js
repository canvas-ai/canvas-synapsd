'use strict';

import Document, { documentSchema as baseDocumentSchema } from '../BaseDocument.js';
import { z } from 'zod';

const DOCUMENT_SCHEMA_NAME = 'data/website';
const DOCUMENT_SCHEMA_VERSION = '1.0';

const websitePayloadSchema = Document.extendDataSchema(
    z.object({
        url: z.string().url(),
        title: z.string().optional(),
        description: z.string().optional(),
        favicon: z.string().url().optional(),
        lang: z.string().optional(),
        author: z.string().optional(),
        keywords: z.array(z.string()).optional(),
    }).passthrough(),
);

const defaultIndexOptions = {
    ftsSearchFields: ['data.url', 'data.title', 'data.description'],
    vectorEmbeddingFields: ['data.title', 'data.description'],
    checksumFields: ['data.url'],
};

export default class Website extends Document {

    constructor(options = {}) {
        options.schema = options.schema || DOCUMENT_SCHEMA_NAME;
        options.schemaVersion = options.schemaVersion || DOCUMENT_SCHEMA_VERSION;
        options.indexOptions = {
            ...defaultIndexOptions,
            ...(options.indexOptions || {}),
        };

        super(options);
    }

    // ----- Getters / Setters -----

    get url() { return this.data.url; }
    get title() { return this.data.title; }

    // dataPaths in metadata holds URIs to downloaded snapshots (HTML, MHTML, screenshot, etc.)
    get snapshots() { return this.metadata.dataPaths || []; }

    // ----- Mutators -----

    addSnapshot(uri) {
        if (!uri) { return this; }
        if (!Array.isArray(this.metadata.dataPaths)) { this.metadata.dataPaths = []; }
        if (!this.metadata.dataPaths.includes(uri)) {
            this.metadata.dataPaths.push(uri);
            this.updatedAt = new Date().toISOString();
        }
        return this;
    }

    removeSnapshot(uri) {
        if (!uri || !Array.isArray(this.metadata.dataPaths)) { return this; }
        this.metadata.dataPaths = this.metadata.dataPaths.filter((p) => p !== uri);
        this.updatedAt = new Date().toISOString();
        return this;
    }

    // ----- Static helpers -----

    static fromData(data) {
        data.schema = DOCUMENT_SCHEMA_NAME;
        return new Website(data);
    }

    static get dataSchema() { return websitePayloadSchema; }
    static get schema() { return baseDocumentSchema; }

    static get jsonSchema() {
        return {
            schema: DOCUMENT_SCHEMA_NAME,
            data: {
                url: 'string',
                title: 'string',
                description: 'string',
                favicon: 'string',
            },
            metadata: {
                dataPaths: ['string'],
            },
        };
    }

    static validate(document) { return baseDocumentSchema.parse(document); }
    static validateData(documentData) { return websitePayloadSchema.parse(documentData); }
}
