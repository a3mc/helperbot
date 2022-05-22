import { expect } from 'chai';
import nock from 'nock';
import dotenv from 'dotenv';
import { CompletedVotesMock, DiscussionsMock, NewSimpleVotesMock } from './mocks';
import { logger } from '../logger';
import moment from 'moment';
import { ApiClient } from '../api-client';

dotenv.config();

describe( 'API Client', () => {
    let apiClient: ApiClient;
    let apiHost = 'https://backend.devxdao.com';
    let nockScope: any;
    logger.silent = true;

    const setNockScope = () => {
        nockScope = nock( apiHost );
    };

    beforeEach( async () => {
        nock.cleanAll();
        setNockScope();
        apiClient = new ApiClient();
    } );

    describe( 'Handling valid responses', () => {
        beforeEach( async () => {
            apiClient.isLoggedIn = false;
            nockScope
                .post( '/api/login' )
                .reply( 200, {
                    success: true,
                    user: {
                        accessTokenAPI: 'test_token'
                    }
                } )
                .get( '/api/me' )
                .reply( 200, {
                    success: true,
                    me: {
                        totalMembers: 40
                    }
                } )
                .get( '/api/shared/global-settings' )
                .reply( 200, {
                    success: true,
                    settings: {
                        quorum_rate: 51,
                        quorum_rate_milestone: 51,
                        quorum_rate_simple: 51,
                    }
                } )
                .get( '/api/' + process.env.FORMAL_SORTED_URL )
                .reply( 200, {
                    votes: NewSimpleVotesMock,
                } );
        } );

        it( 'should sign in and get the settings info', async () => {
            await apiClient.login();
            expect( apiClient.isLoggedIn ).equal( true );
            expect( apiClient.totalMembers ).equal( 40 );
            expect( apiClient.quorumRate ).equal( 51 );
            expect( apiClient.quorumRateMilestone ).equal( 51 );
            expect( apiClient.quorumRateSimple ).equal( 51 );
        } );

        it( 'should get the /me endpoint info', async () => {
            apiClient.isLoggedIn = true;
            await apiClient.me();
            expect( apiClient.isLoggedIn ).equal( true );
            expect( apiClient.totalMembers ).equal( 40 );
        } );

        it( 'should get the /settings endpoint info', async () => {
            apiClient.isLoggedIn = true;
            await apiClient.settings();
            expect( apiClient.quorumRate ).equal( 51 );
            expect( apiClient.quorumRateMilestone ).equal( 51 );
            expect( apiClient.quorumRateSimple ).equal( 51 );
        } );

        it( 'should sign in automatically when getting the votes', async () => {
            const result = await apiClient.get( process.env.FORMAL_SORTED_URL );
            expect( apiClient.isLoggedIn ).equal( true );
            expect( result ).deep.equal( { votes: NewSimpleVotesMock } );
        } );

    } );

    describe( 'Handling invalid responses', () => {
        beforeEach( async () => {
            apiClient.isLoggedIn = false;
            nockScope
                .post( '/api/login' )
                .reply( 200, {
                    success: false,
                } )
                .get( '/api/me' )
                .reply( 200, {
                    success: false,
                } )
                .get( '/api/shared/global-settings' )
                .reply( 200, {
                    success: false,
                } )
                .get( '/api/' + process.env.FORMAL_SORTED_URL )
                .reply( 200, {
                    votes: NewSimpleVotesMock,
                } );
        } );

        it( 'should not sign in and get the settings info', async () => {
            let error: string;
            await apiClient.login().catch( err => error = err.toString() );
            expect( error ).equal( 'Error: Error signing in.' );
            expect( apiClient.isLoggedIn ).equal( false );
        } );

        it( 'should not get the /me endpoint info', async () => {
            let error: string;
            await apiClient.me().catch( err => error = err.toString() );
            expect( error ).equal( 'Error' );
            expect( apiClient.isLoggedIn ).equal( false );
        } );

        it( 'should not get the /settings endpoint info', async () => {
            let error: string;
            await apiClient.settings().catch( err => error = err.toString() );
            expect( error ).equal( 'Error' );
            expect( apiClient.isLoggedIn ).equal( false );
        } );

        it( 'should fail to get the votes without being signed in', async () => {
            let error: string;
            await apiClient.get( process.env.FORMAL_SORTED_URL ).catch( err => error = err.toString() );
            expect( error ).equal( 'Error: Error signing in.' );
            expect( apiClient.isLoggedIn ).equal( false );
        } );

    } );

} );
