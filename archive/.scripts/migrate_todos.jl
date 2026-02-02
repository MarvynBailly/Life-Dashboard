using Dates
using Pkg

Pkg.activate(@__DIR__)
const ROOT_DIR = dirname(@__DIR__)

# --- Helper to parse date from folder structure ---
function parse_date_from_path(path::String)
    parts = splitpath(dirname(path))
    try
        # Assumes structure .../YYYY/MM/DD/todo.md
        d = parse(Int, parts[end])
        m = parse(Int, parts[end-1])
        y = parse(Int, parts[end-2])
        return Date(y, m, d)
    catch
        return nothing
    end
end

function get_todays_todo_path()
    d = now()
    joinpath(ROOT_DIR, string(year(d)), lpad(month(d), 2, '0'), lpad(day(d), 2, '0'), "todo.md")
end

function migrate_tasks()
    todays_path = get_todays_todo_path()
    today_date = today()
    today_str = string(today_date)
    
    if !isfile(todays_path)
        println("Today's todo.md not found. Run new_day.jl first.")
        return
    end

    tasks_to_migrate = String[] # Will hold the formatted lines for the NEW file
    migrated_count = 0

    println("Scanning past files for bidirectional linking...")

    for (root, dirs, files) in walkdir(ROOT_DIR)
        for file in files
            if file == "todo.md"
                full_path = joinpath(root, file)
                file_date = parse_date_from_path(full_path)
                
                # Check if it's a past file
                if file_date !== nothing && file_date < today_date
                    
                    lines = readlines(full_path)
                    file_changed = false
                    
                    # Calculate path FROM old file TO new file
                    # dirname(full_path) is where the old file sits
                    path_to_new = relpath(todays_path, dirname(full_path))
                    
                    # Calculate path FROM new file TO old file
                    # dirname(todays_path) is where the new file sits
                    path_to_old = relpath(full_path, dirname(todays_path))
                    
                    # Track parent-child relationships for nested tasks
                    current_parent_line = nothing
                    
                    for (i, line) in enumerate(lines)
                        # Find incomplete tasks (including nested ones with indentation)
                        m = match(r"^(\s*)-\s*\[ \]\s*(.*)$", line)
                        
                        if m !== nothing
                            indent = m.captures[1]  # Preserve indentation
                            clean_task_text = m.captures[2]  # Task text without checkbox
                            
                            # Check if this task already has a "From" tag to avoid duplicates
                            has_from_tag = occursin(r"\(From \[", clean_task_text)
                            
                            # Determine if this is a top-level task or subtask
                            is_subtask = length(indent) > 0
                            
                            if !is_subtask
                                # Top-level task - always migrate
                                current_parent_line = i
                                
                                if !has_from_tag
                                    # Add "From" tag only if it doesn't already exist
                                    new_entry = "$(indent)- [ ] $clean_task_text  (From [$file_date]($path_to_old))"
                                    updated_line = "$(indent)- [>] $clean_task_text  (Moved to [$today_str]($path_to_new))"
                                else
                                    # Keep existing "From" tag
                                    new_entry = "$(indent)- [ ] $clean_task_text"
                                    updated_line = "$(indent)- [>] $clean_task_text"
                                end
                                
                                push!(tasks_to_migrate, new_entry)
                                lines[i] = updated_line
                                file_changed = true
                                migrated_count += 1
                            else
                                # Subtask - only migrate if parent was migrated
                                if current_parent_line !== nothing
                                    # Don't add "From" tag to subtasks, just preserve structure
                                    new_entry = "$(indent)- [ ] $clean_task_text"
                                    updated_line = "$(indent)- [>] $clean_task_text"
                                    
                                    push!(tasks_to_migrate, new_entry)
                                    lines[i] = updated_line
                                    file_changed = true
                                end
                            end
                        else
                            # Not a task line - reset parent tracking if it's not a continuation
                            if !occursin(r"^\s*-\s*\[", line)
                                current_parent_line = nothing
                            end
                        end
                    end
                    
                    # Save changes to the OLD file
                    if file_changed
                        open(full_path, "w") do f
                            for l in lines; println(f, l); end
                        end
                        println("   Linked & Forwarded tasks from: $file_date")
                    end
                end
            end
        end
    end

    # --- Append to Today's File ---
    if !isempty(tasks_to_migrate)
        open(todays_path, "a") do f
            println(f, "\n\n## Previous Tasks")
            for task in tasks_to_migrate
                println(f, task)
            end
        end
        println("Success! Migrated and Linked $migrated_count tasks.")
    else
        println("No incomplete tasks found.")
    end
end

migrate_tasks()