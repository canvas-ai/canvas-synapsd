'use strict';

// Base document
import BaseDocument from './BaseDocument.js';

// Document Schemas
import Document from './data/Document.js';
import Application from './data/Application.js';
import Contact from './data/Contact.js';
import Device from './data/Device.js';
import Dotfile from './data/Dotfile.js';
import Email from './data/Email.js';
import File from './data/File.js';
import Folder from './data/Folder.js';
import Link from './data/Link.js';
import Message from './data/Message.js';
import Note from './data/Note.js';
import Todo from './data/Todo.js';
import Website from './data/Website.js';

// Tree Abstractions
import Canvas from './internal/layers/Canvas.js';
import Context from './internal/layers/Context.js';
import Label from './internal/layers/Label.js';
import System from './internal/layers/System.js';
import Universe from './internal/layers/Universe.js';
import Workspace from './internal/layers/Workspace.js';

// Default schema registry (for now hard-coded)
const SCHEMA_REGISTRY = {
    // Data schemas
    'data/document': Document,
    'data/application': Application,
    'data/contact': Contact,
    'data/device': Device,
    'data/dotfile': Dotfile,
    'data/email': Email,
    'data/file': File,
    'data/folder': Folder,
    'data/link': Link,
    'data/message': Message,
    'data/note': Note,
    'data/todo': Todo,
    'data/website': Website,

    // Tree Abstractions
    'internal/layers/canvas': Canvas,           // Can store context, feature and filter bitmaps + dashboard / UI layouts
    'internal/layers/context': Context,         // Default context layer(linked to a bitmap)
    'internal/layers/label': Label,             // Label only (no associated bitmaps)
    'internal/layers/system': System,           // System layers
    'internal/layers/universe': Universe,       // Root layer for a workspace
    'internal/layers/workspace': Workspace,     // "Mountpoint" to a workspace
};

export function isDocumentInstance(obj) {
    if (!obj || typeof obj !== 'object') {return false;}

    // Check for essential document properties
    return (
        obj.schema &&
        typeof obj.schema === 'string' &&
        obj.data !== undefined &&
        obj instanceof BaseDocument
    ) || false;
}

export function isDocumentData(obj) {
    if (!obj || typeof obj !== 'object') { return false; }

    // Check for minimal proto object properties (data must be a non-null object)
    return (
        obj.schema &&
        typeof obj.schema === 'string' &&
        obj.data != null && typeof obj.data === 'object' &&
        !(obj instanceof BaseDocument)
    );
}

/**
 * Schema registry singleton
 */

class SchemaRegistry {

    #schemas = new Map();

    constructor() {
        this.#schemas = this.#initSchemaRegistry();
    }

    /**
     * Get schema class by ID
     * @param {string} schemaId Schema identifier
     * @returns {Class} Schema class
     * @throws {Error} If schema is not found
     */
    getSchema(schemaId) {
        if (!this.hasSchema(schemaId)) {
            throw new Error(`Schema not found: ${schemaId}`);
        }
        return this.#schemas.get(schemaId);
    }

    /**
     * Get proto schema definition by ID (for frontend/API validation)
     * @param {string} schemaId Schema identifier
     * @returns {object} Proto schema definition
     */
    getDataSchema(schemaId) {
        const SchemaClass = this.getSchema(schemaId);
        return SchemaClass.dataSchema;
    }

    /**
     * Get JSON schema definition by ID (for frontend/API validation)
     * @param {string} schemaId Schema identifier
     * @returns {object} JSON schema definition
     */
    getJsonSchema(schemaId) {
        const SchemaClass = this.getSchema(schemaId);
        return SchemaClass.jsonSchema;
    }

    /**
     * Check if schema is registered
     * @param {string} schemaId Schema identifier
     * @returns {boolean} True if schema is registered, false otherwise
     */
    hasSchema(schemaId) {
        return this.#schemas.has(schemaId);
    }

    /**
     * List all registered schemas
     * @returns {Array<string>} Array of schema IDs
     */
    listSchemas(prefix) {
        if (!prefix) {
            return Array.from(this.#schemas.keys());
        }

        return Array.from(this.#schemas.keys()).filter(schemaId => schemaId.startsWith(prefix));
    }

    /**
     * Initialize schema registry
     * @returns {Map<string, object>} Schema registry
     */
    #initSchemaRegistry() {
        const schemas = new Map();

        // Initialize schemas from registry
        for (const [schemaId, SchemaClass] of Object.entries(SCHEMA_REGISTRY)) {
            schemas.set(schemaId, SchemaClass);
        }

        return schemas;
    }
}

// Export singleton instance
export default new SchemaRegistry();
