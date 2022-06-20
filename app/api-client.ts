import axios from 'axios';
import { logger } from './logger';

export class ApiClient {
    public isLoggedIn = false;
    public totalMembers: number;
    public quorumRate: number;
    public quorumRateMilestone: number;
    public quorumRateSimple: number;

    private _apiUrlPrefix = process.env.API_URL_PREFIX;
    private _apiAuthToken: string;
    private _requestTimeout = Number( process.env.REQUEST_TIMEOUT );

    // Method to fetch data from the specified endpoint.
    // It uses a wrapper method to prevent some known issues with Axios on network problems.
    async get( endpoint: string ): Promise<any> {
        // First sign in if needed.
        if ( !this.isLoggedIn ) {
            // If we are not signed in at this moment, we need to do it first, get the settings,
            // and then we can relaunch the request.
            await this.login();
            return await this.get( endpoint );
        }
        const result = await this.requestWrapper( 'get', endpoint );
        if ( result.status && result.status >= 200 && result.status < 400 && result.data ) {
            // Re-login if token expired and retry the request.
            if ( result.data.message && result.data.message === 'Not authorized' ) {
                logger.warn( 'Not logged in.' );
                this.isLoggedIn = false;
                await this.login();
                return await this.get( endpoint );
            }
        }
        return result.data;
    }

    // Use specified credentials to obtain a token that is later sent with every request.
    async login(): Promise<any> {
        logger.debug( 'Signing in.' );
        const result = await this.requestWrapper( 'post', 'login', {
            email: process.env.LOGIN,
            password: process.env.PASSWORD
        } );
        if ( result.data && result.data.success && result.data.user ) {
            logger.info( 'Signed in.' );
            this._apiAuthToken = result.data.user.accessTokenAPI;
            // Once we got the token, get some extra information from /me and /settings endpoint,
            // before making any other requests.
            await this.me();
            await this.settings();
            this.isLoggedIn = true;
        } else {
            throw new Error( 'Error signing in.' );
        }
    }

    // We need a number of total active members, that we can get from this endpoint.
    async me(): Promise<any> {
        logger.debug( 'Getting Me info.' );
        const result = await this.requestWrapper( 'get', 'me' );
        if ( result.data && result.data.success && result.data.me ) {
            this.totalMembers = result.data.me.totalMembers;
        } else {
            logger.error( 'Error getting Me endpoint.' )
            throw new Error();
        }
    }

    // Settings return some information we use for dealing with quorum rates.
    async settings(): Promise<any> {
        logger.debug( 'Getting Settings.' );
        const result = await this.requestWrapper( 'get', 'shared/global-settings' );
        if ( result.data && result.data.success && result.data.settings ) {
            this.quorumRate = parseInt( result.data.settings.quorum_rate );
            this.quorumRateMilestone = parseInt( result.data.settings.quorum_rate_milestone );
            this.quorumRateSimple = parseInt( result.data.settings.quorum_rate_simple );
        } else {
            logger.error( 'Error getting Settings.' );
            throw new Error();
        }
    }

    // Prevent axios requests from hanging on network errors.
    // It forces it to fail if it doesn't succeed in the specified amount of time.
    async requestWrapper( method: string, url: string, data: any = null ): Promise<any> {
        const source = axios.CancelToken.source();
        const timeout = setTimeout( () => {
            source.cancel();
        }, this._requestTimeout );

        let config: any = {
            timeout: this._requestTimeout,
            cancelToken: source.token
        };

        let result;
        if ( method === 'get' ) {
            config.headers = { Authorization: 'Bearer ' + this._apiAuthToken };
            result = await axios.get( this._apiUrlPrefix + url, config ).catch( ( error: any ) => {
                logger.warn( error.toString().substring( 0, 255 ) );
                logger.error( 'Error performing a GET request.' );
                clearTimeout( timeout );
                throw new Error();
            } );
        } else {
            result = await axios.post( this._apiUrlPrefix + url, data, config ).catch( ( error: any ) => {
                logger.warn( error.toString().substring( 0, 255 ) );
                logger.error( 'Error performing a POST request.' );
                clearTimeout( timeout );
                throw new Error();
            } );
        }
        clearTimeout( timeout );
        return result;
    }
}
