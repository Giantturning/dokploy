import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { InfoIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";

const schema = z.object({
	logMaxSize: z.string().optional().nullable(),
	logMaxFiles: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

const SIZE_OPTIONS = [
	{ value: "1m", label: "1 MB" },
	{ value: "5m", label: "5 MB" },
	{ value: "10m", label: "10 MB (recommended)" },
	{ value: "25m", label: "25 MB" },
	{ value: "50m", label: "50 MB" },
	{ value: "100m", label: "100 MB" },
];

const FILE_OPTIONS = [
	{ value: "1", label: "1 file" },
	{ value: "3", label: "3 files (recommended)" },
	{ value: "5", label: "5 files" },
	{ value: "10", label: "10 files" },
];

interface Props {
	applicationId: string;
}

export const ShowLogRetention = ({ applicationId }: Props) => {
	const { data, refetch } = api.application.one.useQuery(
		{ applicationId },
		{ enabled: !!applicationId },
	);

	const { mutateAsync, isPending } = api.application.update.useMutation();

	const form = useForm<FormValues>({
		defaultValues: { logMaxSize: null, logMaxFiles: null },
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		if (data) {
			form.reset({
				logMaxSize: data.logMaxSize ?? null,
				logMaxFiles: data.logMaxFiles ?? null,
			});
		}
	}, [data, form]);

	const onSubmit = async (values: FormValues) => {
		await mutateAsync({
			applicationId,
			logMaxSize: values.logMaxSize || null,
			logMaxFiles: values.logMaxFiles || null,
		})
			.then(async () => {
				toast.success("Log retention saved. Redeploy to apply.");
				await refetch();
			})
			.catch(() => {
				toast.error("Failed to save log retention settings");
			});
	};

	const totalEstimate = () => {
		const size = data?.logMaxSize;
		const files = data?.logMaxFiles;
		if (!size || !files) return null;
		const mb = Number.parseFloat(size.replace("m", ""));
		const n = Number.parseInt(files, 10);
		if (Number.isNaN(mb) || Number.isNaN(n)) return null;
		return `~${mb * n} MB max on disk`;
	};

	const estimate = totalEstimate();

	return (
		<Card className="bg-background">
			<CardHeader>
				<CardTitle className="text-xl">Log Retention</CardTitle>
				<CardDescription>
					Limit how much disk space Docker logs can consume. Changes apply after
					redeployment.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="flex flex-col gap-6"
					>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="logMaxSize"
								render={({ field }) => (
									<FormItem>
										<div className="flex items-center gap-2">
											<FormLabel>Max log file size</FormLabel>
											<TooltipProvider>
												<Tooltip delayDuration={0}>
													<TooltipTrigger type="button">
														<InfoIcon className="size-4 text-muted-foreground" />
													</TooltipTrigger>
													<TooltipContent>
														<p>
															Maximum size of a single Docker log file before
															rotation. Maps to --log-opt max-size.
														</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
										<FormControl>
											<Select
												value={field.value ?? ""}
												onValueChange={(v) =>
													field.onChange(v === "" ? null : v)
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="No limit (default)" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="">No limit</SelectItem>
													{SIZE_OPTIONS.map((o) => (
														<SelectItem key={o.value} value={o.value}>
															{o.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="logMaxFiles"
								render={({ field }) => (
									<FormItem>
										<div className="flex items-center gap-2">
											<FormLabel>Max log files</FormLabel>
											<TooltipProvider>
												<Tooltip delayDuration={0}>
													<TooltipTrigger type="button">
														<InfoIcon className="size-4 text-muted-foreground" />
													</TooltipTrigger>
													<TooltipContent>
														<p>
															Number of rotated log files to keep. Oldest files
															are deleted automatically. Maps to --log-opt
															max-file.
														</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
										<FormControl>
											<Select
												value={field.value ?? ""}
												onValueChange={(v) =>
													field.onChange(v === "" ? null : v)
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="No limit (default)" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="">No limit</SelectItem>
													{FILE_OPTIONS.map((o) => (
														<SelectItem key={o.value} value={o.value}>
															{o.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{estimate && (
							<p className="text-sm text-muted-foreground">
								Disk usage estimate: <strong>{estimate}</strong> per container
							</p>
						)}

						<div className="flex justify-end">
							<Button isLoading={isPending} type="submit">
								Save
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
