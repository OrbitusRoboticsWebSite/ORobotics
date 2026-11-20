---
title: "Share a Musimotion creation on the web"
description: "Open a public creation, share its page and play the movie from a browser."
url: "/products/musimotion/community-sharing/"
draft: false
---

[Musimotion]({{< relref "musimotion.md" >}}) · [Browse public creations]({{< asset-url "products/musimotion/#community" >}})

November 20, 2026 · Mac development preview 1.0.0 (7). The website plays a rendered movie on desktop and mobile. The illustrated example uses **Lantern Relay QA**, a three-second Musimotion presentation with an animated star and two notes. Musimotion published this test presentation to the production community. The gallery and player screenshots show the website release candidate rendering that public record and its movie.

## Publish from Musimotion Studio

1. Open the presentation you intend to make public. In the Mac editor, choose **Share** in the toolbar. The window opens **Share Experience**.

{{< musimotion-capture "community-sharing/editor.webp" "Mac editor with Lantern Relay QA open, a selected title, the amber star and the Share toolbar control" >}}

*The Mac development preview shows the test presentation before sharing.*

2. Choose **Community**. Under **Publish this creation**, enter your **Creator name** and a description. Choose **Publish** when you are ready for other Musimotion users to download and remix the project and for visitors to watch its movie on the public website.

{{< musimotion-capture "community-sharing/publish-form.webp" "Mac Community tab with the creator name, description and Publish button for Lantern Relay QA" >}}

*Check the title in the editor and the details in this form before you publish.*

3. After a successful publish, Musimotion shows the creation under **Community Creations**. The test post is available on [the Lantern Relay QA public page]({{< asset-url "products/musimotion/?creation=F0FBD0F3-D8FD-4EF3-AD5B-3B5F67124379#community" >}}).

{{< musimotion-capture "community-sharing/published.webp" "Musimotion Community tab showing the published Lantern Relay QA creation" >}}

*The Mac preview confirmed publication to production. An independent browser fetched the three-second movie, and a Musimotion client downloaded the post as an editable remix.*

4. Publishing requires Musimotion Studio. If you see the subscription screen, you can dismiss it. The preview offers **Restore Purchases** for an existing purchase. Opening the subscription screen alone does not publish the presentation.

{{< musimotion-capture "community-sharing/studio.webp" "Mac Musimotion Studio screen with yearly and monthly options, Restore Purchases and a close button" >}}

*The development preview requested a Studio entitlement. This capture records the subscription screen without making a purchase.*

## Open and share a public page

1. Open the **Community** section on the [Musimotion product page]({{< asset-url "products/musimotion/#community" >}}). Find the title and author. Choose **Open public page** under the creation you want to share.

{{< musimotion-capture "community-sharing/gallery.webp" "Musimotion public gallery showing Lantern Relay QA, its author Musimotion QA, movie controls and Open public page" >}}

*The gallery displays the creator name, duration and scene count for this public test creation.*

2. Select **Play** in the movie controls. Use the scrubber to revisit a moment or switch to full screen. Copy the page address from the browser or use your browser’s Share command. This address opens the same creation even after newer work appears in the gallery.

{{< musimotion-capture "community-sharing/player.webp" "Single public creation page showing Lantern Relay QA paused with an amber star under its title and the movie playback controls" >}}

*The player shows the published native movie paused at 1.75 seconds. Your recipient can play the movie without signing in to the website or installing Musimotion.*

## When a preview is unavailable

3. A post labeled **Movie preview unavailable** has no playable movie attached. If a previously shared link says its creation was removed or hidden, choose **Browse public creations** to return to the gallery. If a movie fails to load partway through, reload its public page to request a fresh media URL. When the service is temporarily unavailable, retry later.

{{< musimotion-capture "community-sharing/missing.webp" "Mobile layout for a missing public creation with a notice and the Browse public creations button" >}}

*The website shows the same notice for a missing or hidden listing. Hiding a listing only affects the gallery display. Community publication creates a public CloudKit record.*

## Share with specific people

1. In **Share Experience**, choose **Invite People** to prepare a private CloudKit invitation. Development validation created an iCloud invitation and verified that the owner could update and reopen the shared data. Production invitations are pending deployment of the CloudKit sharing schema. Guest acceptance has not been verified.
{{< musimotion-capture "community-sharing/invite-error.webp" "Mac Invite People panel with Create Invitation and the status CloudKit did not return an invitation URL" >}}

*The production invitation test returned no invitation URL. A public post is visible to everyone and has different access.*

2. For synchronized live playback and edits, choose **Live Together** and **Start SharePlay**. A FaceTime session with a second participant is required to verify playback synchronization between two devices. This release check did not establish a two-person FaceTime session. Large presentations can use **Invite People** when they exceed the SharePlay attachment limit shown in the app.

{{< musimotion-capture "community-sharing/live.webp" "Mac Share Experience window with Live Together selected, Start SharePlay and the large-media note below" >}}

*The Mac development preview before hosting. This capture shows the starting control. It does not show a connected second participant.*

3. For a rendered movie to send directly, choose **Send Clip**, then **Create Playback**. If the App Clip is unavailable in your storefront, choose **Send Movie** and select the destination in the system share sheet.

{{< musimotion-capture "community-sharing/send-movie.webp" "Mac Send Clip screen offering Send Movie after the US storefront returned no listing for the full app" >}}

*The Mac preview rendered the movie and offered the file. The storefront check did not provide a usable App Clip link.*
