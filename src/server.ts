import app from './app';
import { config } from './config/env';

const startServer = async () => {
    try {
        // Database connection checks can go here

        app.listen(config.PORT, () => {
            console.log(`Server is running in ${config.NODE_ENV} mode on port ${config.PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();