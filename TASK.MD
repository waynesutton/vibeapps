# Feature Name Implementation

Brief description of the feature and its purpose.

## Completed Tasks

- [x] updated bookmarks viewing
- [x] changed site fonts
- [x] change from /u/username to /username in url slugs
- [x] Add a ban member in /admin dashboard
- [x] add sidebar leaderboard to list view
- [x] update clerk admin role permissions in for mod view
- [x] create 404 page
- [x] remove state for profile and admin page to remove sidebar
- [x] add tag bar to header like https://www.ycombinator.com/launches
- [x] add follow profile features
- [x] update comments to have a 10 word minimum
- [x] fix username and name clerk sync
- [x] hide or show views in the dashboard
- [x] add show 3 related products by tags below comments
- [x] update category links in vibe view sidebar
- [x] add rabbit analytics https://app.rybbit.io/
- [x] Joined vibe apps date
- [x] setup clerk production and link
- [x] link to sections on profile page
- [x] download icons for all the apps
- [x] sort tags in dashboard
- [x] Setup hosting on Netlify
- [x] Setup domain name on Netlify
- [x] confirm https://www.cookieyes.com/ is setup
- [x] test forms
- [x] setup llms.txt, sitemap.xml and robots.txt
- [x] link image in setting popup box
- [x] fix name on story detailed page
- [x] hide resendhackathon on story detailed page
- [x] hide extra sign in to commit
- [x] add new tags url slugs for pages
- [x] put reports under user moderation in admin dashboard
- [x] judging scale from 1-10 vs 1-5
- [x] search for tags in admin
- [x] allow to number sort tags
- [x] search for submission name next to number in the judging form
- [x] add view judging results to the judging form
- [x] Add options to add team
- [x] add option for multiple image upload
- [x] added markdown support and preview for story details page
- [x] fix open graph image
- [x] add gallery images also show up in judging page with popup modal
- [x] added judges score moderations system
- [x] add @mentions for usernames in judging notes, comments for profiles and in the comments section.
- [x] add notification section like product hunt that works with sending emails too, move notification dot and background from page
- [x] update templates.ts
- [x] fix links for weekly emails
- [x] report a user option on profile page
- [x] update alert's if admin pins or adds a message to their app
- [x] setup resend for emails for notifications on post
- [x] add option to turn off email notifications on user profiles
- [x] add reporting users or post email option to admin from adminalerrtemails.md
- [x] add changelog tracking on story detail page that shows all user edits with date/time in user's timezone
- [x] always show changelog section with anchor links from sidebar and judging page
- [x] add inbox direct message and inbox email notification from friendsonlyinbox.md
- [x] test inbox direct message and inbox email notification from friendsonlyinbox.md
- [x] change notifications for inbox to be inbox check in
- [x] fix "Invalid Date" display on judging interface page submission timestamps
- [x] add inbox icon to header
- [x] fix inbox scrolling behavior to prevent whole page from scrolling, only chat window and conversation list scroll independently
- [x] redesign inbox page with messenger-style 3-column layout with right sidebar showing Most Vibes This Week, Recent Vibers, and Top Categories This Week
- [x] implement soft delete for inbox conversations with automatic undelete when receiving new messages
- [x] add clickable @username links in inbox chat messages that link to user profiles (without hover cards)
- [x] make usernames in conversation list and chat header clickable links to user profiles
- [x] fix "Not authenticated" errors in markConversationRead mutation
- [x] fix deleted conversations showing old messages when restarted - now marks all messages as deleted when deleting conversation
- [x] fix deleted conversation still appearing in inbox - added auto-clear when conversation no longer exists in list
- [x] fix missing input box when starting new conversation after deletion - added fallback query to fetch conversation details
- [x] fix upsertConversation to remove current user's deletion record when restarting conversation
- [x] fix message sync - when user deletes conversation and other user sends message, conversation reappears in recipient's inbox
- [x] add report user feature in inbox conversation header with Flag icon (light grey, hover black)
- [x] integrate inbox user reports with UserReportManagement admin dashboard
- [x] send email alerts to admins/managers when users are reported in inbox
- [x] add block user feature in inbox conversation header with Ban icon (light grey, hover black)
- [x] blocked users cannot send messages to users who blocked them
- [x] block button shows block/unblock state and allows toggling
- [x] replace browser alerts/prompts with custom modals matching site design
- [x] add error banner for blocked user messages instead of console errors
- [x] add custom report modal with textarea (500 char limit)
- [x] in judging interface keep the original date but ia user make changes add just the date and time the submission was modified and still link to change log
- [x] add an anchor link to change log and link to
- [x] in Content moderation add a show by date range submissions
- [x] Content moderation keep hide, add archive that hides from Content moderation but still able to see by dropdown selection
- [x] fixed judging progress
- [x] added edit add tags to submissions

## In Progress Tasks

- [ ]

## Future Tasks - Roadmap

- [ ] test judging progress on results page
- [ ] clerk roles for hackathon organizers to see judges section in admin dashboard only from friendsonlyinbox.md

## TBD Future task

- [ ] add admin moderation to make app post by approval only

## Bugs

## Implementation Plan

Detailed description of how the feature will be implemented.

### Relevant Files

- search [files.MD](files.MD)
