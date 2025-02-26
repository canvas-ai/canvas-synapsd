'use strict';

// Utils
import path from 'path';
import { mkdirp } from 'mkdirp'

import debugInstance from 'debug';
const debug = debugInstance('canvas:service:synapsd:lmdb');

// Database backend
import { open } from 'lmdb';

/**
 * Canvas LMDB wrapper, originally LevelDB
 */

class Db {

    #dataset = 'default';
    #path;

    constructor(options, dataset) {

        // Parse input arguments
        if (options.open === undefined) {
            // Let's make path a required option
            if (!options.path) { throw new Error('LMDB database path not provided'); }

            options = {
                // Database paths
                path: options.path,
                backupPath: options.backupPath || path.join(options.path, 'backup'),

                // Backup options
                backupOnOpen: options.backupOnOpen || false,
                backupOnClose: options.backupOnClose || false,

                // Internals
                maxDbs: options.maxDbs || 64,
                readOnly: options.readOnly || false,
                logLevel: options.logLevel || 'info',
                compression: options.compression || true,
                cache: options.cache || true,
                ...options,
            };

            this.db = new open(options);
            debug(`Initialized LMDB database backend at "${options.path}"`);
        } else {
            this.db = options;
            this.#dataset = dataset;
            debug(`Initialized LMDB dataset "${dataset}"`);
        }

        // Set the db path in the wrapper class
        this.#path = options.path;

        this.backupOptions = {
            backupPath: options.backupPath,
            backupOnOpen: options.backupOnOpen,
            backupOnClose: options.backupOnClose,
            compact: options.backupCompact,
        };

        if (this.backupOptions.backupOnOpen) {
            this.#backupDatabase();
        }

    }

    /**
     * Custom methods
     */

    get path() { return this.#path; }
    get backupPath() { return this.backupOptions.backupPath; }

    // Returns the status of the underlying database / dataset
    get status() { return this.db.status; }

    // Returns stats of the underlying database / dataset
    get stats() { return this.db.getStats(); }

    listKeys() {
        let keys = [];
        this.db.getKeys().forEach(element => {
            keys.push(element);
        });
        return keys;
    }

    listValues() {
        let values = [];
        this.db.getRange().forEach(element => {
            values.push(element.value);
        });
        return values;
    }

    listEntries() {
        let entries = [];
        this.db.getRange().forEach(element => {
            entries.push(element);
        });
        return entries;
    }

    // Creates a new dataset using the same wrapper class
    createDataset(dataset, options = {}) {
        debug(`Creating new dataset "${dataset}" using options: ${JSON.stringify(options)}`);
        let db = this.db.openDB(dataset, options);
        return new Db(db, dataset);
    }


    /**
     * Map() like (sync) interface
     */

    clear() { return this.db.clearSync(); }

    delete(key) { return this.db.removeSync(key); }

    entries() { return this.db.getRange(); }    // Iterator

    forEach() { /* TODO */ }

    has(key) { return this.db.doesExist(key); } // bool

    keys() { return this.db.getKeys(); }        // Iterator

    values() { return this.listValues(); }   // TODO: Fixme

    set(key, value) { return this.db.putSync(key, value); }


    /**
     * Native LMDB methods (small subset)
     */

    get(key, options) { return this.db.get(key, options); }

    getEntry(key, options) { return this.db.getEntry(key, options); }

    getBinary(key) { return this.db.getBinary(key); }

    getMany(keys, cb){ return this.db.getMany(keys, cb); }

    put(key, value, version) { return this.db.put(key, value, version); }

    remove(key) { return this.db.remove(key); }

    removeVersion(key, version) {
        if (version === undefined) {throw new Error('Version must be provided');}
        return this.db.remove(key, version);
    }

    removeValue(key, value) { return this.db.remove(key, value); }

    putSync(key, value, version) { return this.db.putSync(key, value, version); }

    removeSync(key) { return this.db.removeSync(key); }

    removeValueSync(key, value) { return this.db.removeSync(key, value); }

    getValues(key, rangeOptions) { return this.db.getValues(key, rangeOptions); }

    getValuesCount(key, rangeOptions) { return this.db.getValuesCount(key, rangeOptions); }

    getKeys(rangeOptions) { return this.db.getKeys(rangeOptions); }

    getKeysCount(rangeOptions) { return this.db.getKeysCount(rangeOptions); }

    getRange(rangeOptions) { return this.db.getRange(rangeOptions); }

    getCount(rangeOptions) { return this.db.getCount(rangeOptions); }

    doesExist(key) { return this.db.doesExist(key); }

    doesExistValue(key, value) { return this.db.doesExist(key, value); }

    doesExistVersion(key, version) { return this.db.doesExist(key, version); }

    drop() { return this.db.drop(); }

    dropSync() { return this.db.dropSync(); }

    getStats() { return this.db.getStats(); }

    clearAsync() { return this.db.clearAsync(); }

    clearSync() { return this.db.clearSync(); }

    backup(path, compact = true) { return this.db.backup(path, compact); }

    close() { return this.db.close(); }


    /**
     * Internal methods
     */

    #backupDatabase(compact = true) {
        const backupPath = this.#generateBackupFolderPath();

        // Create the backup folder
        try {
            mkdirp.sync(backupPath);
            debug(`Created backup folder "${backupPath}"`);
        } catch (error) {
            debug(`Error occurred while creating backup folder: ${error.message}`);
            throw error;
        }

        debug(`Backing up database "${this.#path}" to "${backupPath}"`);
        this.db.backup(backupPath, compact);
    }

    #generateBackupFolderPath() {
        const dateString = new Date().toISOString().split('T')[0].replace(/-/g, '');
        let backupFolderName = dateString;
        let backupFolderPath = path.join(this.backupOptions.backupPath, backupFolderName);

        let counter = 1;
        while (fs.existsSync(backupFolderPath)) {
            backupFolderName = `${dateString}.${counter}`;
            backupFolderPath = path.join(this.backupOptions.backupPath, backupFolderName);
            counter++;
        }

        return backupFolderPath;
    }

}

export default Db;
