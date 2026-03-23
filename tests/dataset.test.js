import { initializeTestDB, cleanupTestDB } from './helpers.js';

describe('document datasets', () => {
    let db;

    beforeAll(async () => {
        db = await initializeTestDB();
    });

    afterAll(async () => {
        await cleanupTestDB(db);
    });

    it('keeps incoming documents out of the main dataset', async () => {
        const incomingId = await db.insertDocument(
            { schema: 'data/abstraction/note', data: { title: 'Incoming', content: 'Queued' } },
            { dataset: 'incoming', context: '/email/account-a' },
        );

        const mainDocs = await db.findDocuments('/');
        const incomingDocs = await db.findDocuments('/email/account-a', [], [], { dataset: 'incoming' });
        const incomingDoc = await db.getDocumentById(incomingId, { dataset: 'incoming' });

        expect(mainDocs.map((doc) => doc.id)).not.toContain(incomingId);
        expect(incomingDocs.map((doc) => doc.id)).toContain(incomingId);
        expect(incomingDoc?.data?.title).toBe('Incoming');
        expect(await db.getDocumentById(incomingId)).toBeNull();
    });

    it('builds a separate tree for the incoming dataset', async () => {
        await db.insertDocument(
            { schema: 'data/abstraction/note', data: { title: 'Chat import', content: 'hello' } },
            { dataset: 'incoming', context: '/chat/slack/general' },
        );

        const mainTree = db.jsonTree;
        const incomingTree = await db.getJsonTreeForDataset('incoming');

        expect(mainTree.children?.some((child) => child.name === 'chat')).toBe(false);
        expect(incomingTree.children?.some((child) => child.name === 'chat')).toBe(true);
    });
});
