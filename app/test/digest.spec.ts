import { Digest } from '../digest';
import { expect } from 'chai';
import nock from 'nock';
import dotenv from 'dotenv';
import { CompletedVotesMock, DiscussionsMock, NewSimpleVotesMock } from './mocks';
import { logger } from '../logger';
import moment from 'moment';

dotenv.config();

describe( 'Digest', () => {
    let digest: Digest;
    let apiHost = 'https://backend.devxdao.com';
    let nockScope: any;
    logger.silent = true;

    const setNockScope = () => {
        nockScope = nock( apiHost )
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
            .persist( true );
    };

    beforeEach( async () => {
        nock.cleanAll();
        setNockScope();
        digest = new Digest();
    } );

    describe( 'Handling empty responses', () => {
        beforeEach( async () => {
            nockScope
                .get( '/api/' + process.env.FORMAL_SORTED_URL )
                .reply( 200, {
                    votes: [],
                } )
                .get( '/api/' + process.env.INFORMAL_SORTED_URL )
                .reply( 200, {
                    votes: [],
                } )
                .get( '/api/' + process.env.DISCUSSIONS_URL )
                .reply( 200, {
                    proposals: [],
                } )
                .get( '/api/' + process.env.COMPLETED_SORTED_URL )
                .reply( 200, {
                    votes: [],
                } )
        } );

        it( 'should return an empty "Digest"', async () => {
            expect( await digest.createDigest() ).equal( '' );
        } );

        it( 'should return an empty "Simple list"', async () => {
            expect( await digest.listSimpleAdmin() ).equal( '' );
        } );

        it( 'should return an empty "New Simples" object', async () => {
            expect( await digest.newProposal() ).deep.equal( {
                informalIds: [],
                formalIds: [],
                text: ''
            } );
        } );

        it( 'should return an empty "New Failed - No Quorum" object', async () => {
            expect( await digest.newFailedNoQuorum() ).deep.equal( {
                votesIds: [],
                text: ''
            } );
        } );
    } );

    describe( 'Handling mocked responses', () => {
        beforeEach( async () => {
            for ( const discussion of DiscussionsMock ) {
                discussion.approved_at = moment().add( -2, 'days' ).utc().toISOString();
            }
            DiscussionsMock[2].approved_at = moment().add( -88, 'days' ).utc().toISOString();
            nockScope
                .get( '/api/' + process.env.FORMAL_SORTED_URL )
                .reply( 200, {
                    votes: NewSimpleVotesMock.slice( -1 ),
                } )
                .get( '/api/' + process.env.INFORMAL_SORTED_URL )
                .reply( 200, {
                    votes: NewSimpleVotesMock.slice( 0, 2 ),
                } )
                .get( '/api/' + process.env.DISCUSSIONS_URL )
                .reply( 200, {
                    proposals: DiscussionsMock,
                } )
                .get( '/api/' + process.env.COMPLETED_SORTED_URL )
                .reply( 200, {
                    votes: CompletedVotesMock,
                } )
        } );

        it( 'should return a correct "New Simples" object', async () => {
            expect( await digest.newProposal() ).deep.equal( {
                informalIds: [2000001, 2000002],
                formalIds: [2000003],
                text: `🟦 __*2 new proposal* just entered _INFORMAL_:__\n\n[\\#1000001](https://portal.devxdao.com/app/proposal/1000001) _simple_: \"Simple proposal 1\"\n\\(_0/40 voted_\\. _Time left: 23h 59m_\\)\n\n[\\#1000002](https://portal.devxdao.com/app/proposal/1000002) _simple_: \"Simple proposal 2\"\n\\(_0/40 voted_\\. _Time left: 23h 55m_\\)\n\n🟩 __*1 new proposal* just entered _FORMAL_:__\n\n[\\#1000003](https://portal.devxdao.com/app/proposal/1000003) _simple_: \"Simple proposal 3 in Formal\"\n\\(_1/33 voted_\\. _Time left: 23h 55m_\\)\n\n`
            } );
        } );

        it( 'should return a "Digest" text containing expected records', async () => {
            const digestText = await digest.createDigest();
            expect( digestText ).contain( 'Simple proposal 3 in Formal' );
            expect( digestText ).contain( '*1 discussion* require attention' );
            expect( digestText ).contain( '*1 discussion* require attention' );
            expect( digestText ).contain( '*1 discussion* is ending within 7 days' );
        } );

        it( 'should return correct "New Failed - No Quorum" object', async () => {
            expect( await digest.newFailedNoQuorum() ).deep.equal( {
                votesIds: [5000001],
                text: `🔥 __*1 failed without a quorum:*__\n\n[\\#6000001](https://portal.devxdao.com/app/` +
                    `proposal/6000001) _simple_: \"Completed failed with no quorum\"\n\n`
            } );
        } );
    } );

    describe( 'Class methods', () => {
        it( 'should not have unescaped reserved characters in escapeText() method', () => {
            expect( digest.escapeText( '_*[]~>#+-=()') ).not.to.equal( '_*[]~>#+-=()' );
        } );

        it( 'should correctly escape reserved characters in escapeText() method', () => {
            expect( digest.escapeText( '_*[]~>#+-=()') ).equal( `\\_\\*\\[\\]\\~\\>\\#\\+\\-\\=\\(\\)` );
        } );

        it( 'should format "timeLeft" correctly in timeLeftToHM()', () => {
            expect( digest.timeLeftToHM( '08:12:48') ).equal( '08h 12m' );
            expect( digest.timeLeftToHM( '00:01:59') ).equal( '00h 01m' );
        } );
    } );
} );
