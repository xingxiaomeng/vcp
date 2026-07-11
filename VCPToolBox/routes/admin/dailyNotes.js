const express = require('express');

module.exports = function(options) {
    const {
        dailyNoteRootPath,
        DEBUG_MODE,
    } = options;

    const router = express.Router();

    const dailyNotesRoutes = require('../dailyNotesRoutes')(dailyNoteRootPath, DEBUG_MODE, {
        resourceLabel: '日记',
        allowedExtensions: 'md,txt',
        ignoredFolders: 'VectorStore,DebugLog',
    });
    router.use('/dailynotes', dailyNotesRoutes);

    return router;
};
