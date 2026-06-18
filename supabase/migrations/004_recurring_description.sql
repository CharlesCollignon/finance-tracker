-- Optional description on recurring templates for extra context

alter table recurring_templates
  add column description text check (char_length(description) <= 500);
