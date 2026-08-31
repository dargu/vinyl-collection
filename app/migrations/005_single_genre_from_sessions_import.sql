-- Collapse the multi-genre arrays left by the Sessions import down to
-- a single house genre each, matching how the app itself writes them.
-- Safe to re-run.

begin;

update records set genres = ARRAY['Jazz'] where owner = 'Charlie' and artist = 'Alfa Mist' and title = 'Antiphon';
update records set genres = ARRAY['Rock'] where owner = 'Charlie' and artist = 'Dave Matthews, Tim Reynolds' and title = 'Live At Luther College';
update records set genres = ARRAY['Reggae'] where owner = 'Charlie' and artist = 'Fat Freddy''s Drop' and title = 'Dr Boondigga & The Big BW';
update records set genres = ARRAY['Jazz'] where owner = 'Charlie' and artist = 'Flea' and title = 'Honora';
update records set genres = ARRAY['Rock'] where owner = 'Charlie' and artist = 'Led Zeppelin' and title = 'Physical Graffiti';
update records set genres = ARRAY['Rock'] where owner = 'Charlie' and artist = 'Talking Heads' and title = 'Stop Making Sense';
update records set genres = ARRAY['Electronic'] where owner = 'Charlie' and artist = 'The Blaze' and title = 'Territory';
update records set genres = ARRAY['Blues'] where owner = 'Diego' and artist = 'B.B. King' and title = 'B.B. King Live In Cook County Jail';
update records set genres = ARRAY['Afrobeat'] where owner = 'Diego' and artist = 'Fela Kuti, Africa 70' and title = 'Sorrow, Tears & Blood';
update records set genres = ARRAY['Salsa/Tropical'] where owner = 'Diego' and artist = 'Rubén González' and title = 'Introducing...';
update records set genres = ARRAY['Pop'] where owner = 'Joul' and artist = 'Beyoncé' and title = 'Renaissance';
update records set genres = ARRAY['Alternative/Indie'] where owner = 'Joul' and artist = 'Caroline Rose' and title = 'Loner';
update records set genres = ARRAY['Alternative/Indie'] where owner = 'Joul' and artist = 'Fiona Apple' and title = 'When The Pawn';
update records set genres = ARRAY['Rock'] where owner = 'Joul' and artist = 'King Gizzard And The Lizard Wizard' and title = 'Live At Levitation ''14 And ''16';
update records set genres = ARRAY['Hip Hop'] where owner = 'Joul' and artist = 'Lauryn Hill' and title = 'The Miseducation Of Lauryn Hill';
update records set genres = ARRAY['Rock'] where owner = 'Joul' and artist = 'Led Zeppelin' and title = 'Houses Of The Holy';
update records set genres = ARRAY['Alternative/Indie'] where owner = 'Joul' and artist = 'My Bloody Valentine' and title = 'mbv';
update records set genres = ARRAY['Alternative/Indie'] where owner = 'Joul' and artist = 'The Stone Roses' and title = 'The Stone Roses';
update records set genres = ARRAY['Jazz'] where owner = 'Joul' and artist = 'Various' and title = 'Moments (The Montreux Years Volume 1)';
update records set genres = ARRAY['Salsa/Tropical'] where owner = 'Other' and artist = 'Afro-Cuban All Stars' and title = 'A Toda Cuba Le Gusta';
update records set genres = ARRAY['Salsa/Tropical'] where owner = 'Other' and artist = 'Cal Tjader' and title = 'Soul Sauce';
update records set genres = ARRAY['Salsa/Tropical'] where owner = 'Other' and artist = 'Compay Segundo' and title = 'Calle Salud';
update records set genres = ARRAY['Salsa/Tropical'] where owner = 'Other' and artist = 'Irakere' and title = 'Grupo Irakere';
update records set genres = ARRAY['Salsa/Tropical'] where owner = 'Other' and artist = 'Okuté' and title = 'Okuté';
update records set genres = ARRAY['Electronic'] where owner = 'Roy' and artist = 'Carlos Metta' and title = 'Chingos De Changos';
update records set genres = ARRAY['Jazz'] where owner = 'Roy' and artist = 'Ezra Collective' and title = 'Where I’m Meant To Be';
update records set genres = ARRAY['Electronic'] where owner = 'Roy' and artist = 'Moderat' and title = 'III';
update records set genres = ARRAY['Alternative/Indie'] where owner = 'Roy' and artist = 'The Flaming Lips' and title = 'Yoshimi Battles The Pink Robots';
update records set genres = ARRAY['Hip Hop'] where owner = 'Ysita' and artist = 'A Tribe Called Quest' and title = 'The Anthology';
update records set genres = ARRAY['Electronic'] where owner = 'Ysita' and artist = 'AIR' and title = 'Moon Safari';
update records set genres = ARRAY['Rock'] where owner = 'Ysita' and artist = 'David Bowie' and title = 'The Rise And Fall Of Ziggy Stardust And The Spiders From Mars';
update records set genres = ARRAY['Jazz'] where owner = 'Ysita' and artist = 'Ezra Collective' and title = 'Dance, No One''s Watching';
update records set genres = ARRAY['Afrobeat'] where owner = 'Ysita' and artist = 'Fela Kuti, Africa 70' and title = 'Expensive Shit';
update records set genres = ARRAY['Funk'] where owner = 'Ysita' and artist = 'Labi Siffre' and title = 'Remember My Song';
update records set genres = ARRAY['Alternative/Indie'] where owner = 'Ysita' and artist = 'LCD Soundsystem' and title = 'This Is Happening';
update records set genres = ARRAY['Electronic'] where owner = 'Ysita' and artist = 'Massive Attack' and title = 'Mezzanine';
update records set genres = ARRAY['Electronic'] where owner = 'Ysita' and artist = 'Portishead' and title = 'Dummy';
update records set genres = ARRAY['Salsa/Tropical'] where owner = 'Ysita' and artist = 'Ray Barretto' and title = 'Acid';
update records set genres = ARRAY['Alternative/Indie'] where owner = 'Ysita' and artist = 'Sault' and title = '5';

commit;

-- Should return no rows once this has run.
select owner, artist, title, genres from records where array_length(genres, 1) > 1;

