using Dates
using Pkg

# 1. Activate the environment located in the same folder as this script
Pkg.activate(@__DIR__)

# 2. Define Paths relative to this script
# @__DIR__ is "Life/scripts"
# dirname(@__DIR__) goes up one level to "Life/"
const ROOT_DIR = dirname(@__DIR__)
const TEMPLATE_DIR = joinpath(ROOT_DIR, ".templates")

function create_day()
    # Get today's date
    d = now()
    y, m, day_str = string(year(d)), lpad(month(d), 2, '0'), lpad(day(d), 2, '0')

    # Define the target directory: Life/2025/12/07
    target_dir = joinpath(ROOT_DIR, y, m, day_str)

    # 3. Create Directory if it doesn't exist
    if !isdir(target_dir)
        mkpath(target_dir)
        println("Created directory: $target_dir")
    else
        println("Directory already exists: $target_dir")
    end

    # 4. Copy Templates
    # We loop through files in the template folder to be flexible
    for filename in readdir(TEMPLATE_DIR)
        source_file = joinpath(TEMPLATE_DIR, filename)
        dest_file = joinpath(target_dir, filename)

        # Only copy if the file doesn't exist (Protect data!)
        if !isfile(dest_file)
            cp(source_file, dest_file)
            println("Created: $filename")
        else
            println("Skipped (already exists): $filename")
        end
    end
end

# Run the function
create_day()