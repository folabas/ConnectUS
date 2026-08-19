/**
 * Resolves a fixed list of Internet Archive identifiers into seed entries, and
 * proves each one plays before it is used.
 *
 * Deliberately not driven by search: the archive's ranking shifts between runs,
 * so the same query returned a different "best match" each time — including
 * four-hour drive-in triple features in place of the film asked for. A starter
 * catalogue has to be deterministic, so the identifiers are pinned and only
 * verified here.
 *
 * The previous seed listed six invented titles pointing at Google's sample
 * bucket, which now returns 403, so a new user's first click was a dead link.
 *
 * Usage:  npx ts-node --transpile-only scripts/find-seed-films.ts
 */

import { writeSync } from 'fs';
import { resolveArchiveItem } from '../src/services/archiveService';

const say = (line: string) => writeSync(1, `${line}\n`);

/** Candidates per film, tried in order until one resolves and seeks. */
const CANDIDATES: Array<{ genre: string; ids: string[] }> = [
    { genre: 'Horror', ids: ['nosferatu-1922_202504', 'Nosferatu1922', 'nosferatu_1922'] },
    {
        genre: 'Horror',
        ids: ['night_of_the_living_dead', 'NightOfTheLivingDead_201301', 'night-of-the-living-dead-1968'],
    },
    { genre: 'Comedy', ids: ['HisGirlFriday1940', 'his_girl_friday', 'HisGirlFriday'] },
    { genre: 'Horror', ids: ['CarnivalOfSouls', 'carnival_of_souls', 'CarnivalOfSouls1962'] },
    { genre: 'Drama', ids: ['Detour1945', 'detour_1945', 'DetourFilmNoir'] },
    { genre: 'Sci-Fi', ids: ['Plan9FromOuterSpace1959', 'plan_9_from_outer_space', 'Plan9FromOuterSpace'] },
    { genre: 'Horror', ids: ['TheCabinetOfDrCaligari1920', 'DasCabinetDesDrCaligari', 'caligari'] },
    { genre: 'Comedy', ids: ['TheGeneral1926', 'the_general_1926', 'BusterKeatonTheGeneral'] },
    { genre: 'Thriller', ids: ['the_stranger', 'TheStranger1946', 'TheStranger_201303'] },
    { genre: 'Drama', ids: ['MeetJohnDoe', 'meet_john_doe_1941', 'MeetJohnDoe1941'] },
    { genre: 'Sci-Fi', ids: ['TheLastManOnEarth', 'the_last_man_on_earth', 'LastManOnEarth1964'] },
    { genre: 'Thriller', ids: ['DOA_1949', 'DetourDOA', 'd.o.a.1949'] },
    { genre: 'Sci-Fi', ids: ['PlanNineFromOuterSpace', 'plan_nine_from_outer_space', 'Plan_9_From_Outer_Space'] },
    { genre: 'Horror', ids: ['DasCabinetDesDrCaligari1920', 'the_cabinet_of_dr_caligari', 'CabinetOfDrCaligari'] },
    { genre: 'Drama', ids: ['CharlieChaplinTheKid', 'TheKid1921', 'the_kid_1921'] },
    { genre: 'Comedy', ids: ['ShermlockSholmes', 'sherlock_jr', 'SherlockJr1924'] },
];

/**
 * Follows the redirect by hand: archive.org sends you to a regional node on a
 * different host, and fetch drops the Range header across a cross-origin
 * redirect — which made every file look unseekable when they are not.
 */
async function servesRanges(url: string): Promise<boolean> {
    try {
        let target = url;
        for (let hop = 0; hop < 3; hop++) {
            const probe = await fetch(target, { method: 'GET', redirect: 'manual' });
            const location = probe.headers.get('location');
            void probe.body?.cancel();
            if (!location) break;
            target = new URL(location, target).toString();
        }
        const response = await fetch(target, { headers: { Range: 'bytes=0-1023' } });
        void response.body?.cancel();
        return response.status === 206;
    } catch {
        return false;
    }
}

async function main() {
    const accepted: string[] = [];

    for (const candidate of CANDIDATES) {
        for (const id of candidate.ids) {
            let item;
            try {
                item = await resolveArchiveItem(id, 20_000);
            } catch {
                continue;
            }
            if (!item?.videoUrl) continue;

            // Archive nodes are intermittently unavailable: the same file
            // answers 206 on one attempt and fails the next. One probe is not
            // evidence the file is unusable, so give it a few tries.
            let seekable = false;
            for (let attempt = 0; attempt < 3 && !seekable; attempt++) {
                seekable = await servesRanges(item.videoUrl);
                if (!seekable) await new Promise((r) => setTimeout(r, 1500));
            }
            if (!seekable) {
                say(`  ${id}: resolved but never served a range in 3 attempts`);
                continue;
            }

            say(`OK  ${item.title} (${item.year ?? '?'}) — ${item.duration ?? '?'}  [${id}]`);
            accepted.push(
                [
                    '    {',
                    `        title: ${JSON.stringify(item.title)},`,
                    `        image: ${JSON.stringify(item.image)},`,
                    `        duration: ${JSON.stringify(item.duration ?? 'N/A')},`,
                    "        rating: 'N/A',",
                    `        genre: ${JSON.stringify(candidate.genre)},`,
                    `        videoUrl: ${JSON.stringify(item.videoUrl)},`,
                    `        archiveId: ${JSON.stringify(item.identifier)},`,
                    "        source: 'archive' as const,",
                    `        description: ${JSON.stringify(
                        (item.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
                    )},`,
                    `        year: ${item.year ?? 'undefined'},`,
                    '    },',
                ].join('\n'),
            );
            break;
        }
    }

    say(`\n=== ${accepted.length} verified ===\n`);
    say(accepted.join('\n'));
    process.exit(0);
}

main().catch((error) => {
    say(`crashed: ${error}`);
    process.exit(1);
});
