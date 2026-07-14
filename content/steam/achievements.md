# Steamworks Achievements — configuration reference

Enter these into Steamworks with the **exact API name (id)** below so
`Platform.unlock_achievement(id)` maps correctly. Display names/descriptions are
the shippable copy; localize in Steamworks per language. Source of truth:
`content/achievements/achievements.json` (40 achievements).

| API name (id) | Display name | Hidden |
|---------------|--------------|--------|
| ach_heavy_baggage | Heavy Baggage | no |
| ach_first_day_on_the_job | First Day on the Job | no |
| ach_sofa_so_good | Sofa, So Good | no |
| ach_let_that_sink_in | Let That Sink In | no |
| ach_emotional_support_furniture | Emotional Support Furniture | no |
| ach_the_door_was_like_that | The Door Was Like That | no |
| ach_wardrobe_malfunction | Wardrobe Malfunction | no |
| ach_mirror_issues | Mirror Issues | no |
| ach_applause_required | Applause Required | no |
| ach_lighten_up | Lighten Up | no |
| ach_bed_bath_and_beyond_help | Bed, Bath and Beyond Help | no |
| ach_chairperson_of_the_board | Chairperson of the Board | no |
| ach_packed_and_loaded | Packed and Loaded | no |
| ach_zero_star_insurance_claim | Zero-Star Insurance Claim | no |
| ach_unlicensed_therapist | Unlicensed Therapist | no |
| ach_ghosted_by_a_couch | Ghosted by a Couch | no |
| ach_fridge_benefits | Fridge Benefits | no |
| ach_employee_of_the_moment | Employee of the Moment | no |
| ach_this_could_have_been_an_email | This Could Have Been an Email | no |
| ach_handle_with_emotional_care | Handle With Emotional Care | no |
| ach_property_rejection | Property Rejection | no |
| ach_no_object_left_behind | No Object Left Behind | no |
| ach_moving_experience | Moving Experience | no |
| ach_heavy_petting | Heavy Petting | no |
| ach_the_rug_really_tied_the_room_together | The Rug Really Tied the Room Together | no |
| ach_boxed_in | Boxed In | no |
| ach_piano_manhandled | Piano Manhandled | no |
| ach_trust_issues | Trust Issues | no |
| ach_overqualified_mover | Overqualified Mover | no |
| ach_overtime | Overtime | no |
| ach_paranormal_professional | Paranormal Professional | no |
| ach_perfect_move | Perfect Move | no |
| ach_total_write_off | Total Write-Off | no |
| ach_it_followed_us_home | It Followed Us Home | yes |
| ach_vehicle_possession | Vehicle Possession | yes |
| ach_friends_help_friends_move | Friends Help Friends Move | no |
| ach_four_people_one_sofa | Four People, One Sofa | no |
| ach_extremely_normal_furniture | Extremely Normal Furniture | no |
| ach_the_house_is_furniture | The House Is Furniture | yes |
| ach_baggage_claimed | Baggage Claimed | no |

> The game functions normally with **no** App ID; achievements simply persist
> locally. Demo builds never award achievements.
